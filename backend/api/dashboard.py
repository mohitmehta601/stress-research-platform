import hashlib
import re
import secrets
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlencode

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from pymongo.asynchronous.database import AsyncDatabase

from backend.app.config import get_settings
from backend.database.mongodb import get_database, utc_now
from backend.services.email import send_email
from backend.services.auth import (
    generate_participant_code,
    hash_password,
    require_researcher,
    require_super_admin,
)
from backend.services.research import EXPORTS, collect, csv_response_content

router = APIRouter(prefix="/dashboard", tags=["research dashboard"])
settings = get_settings()

PARTICIPANT_ROLE_FILTER = {"role": "participant"}


class ManualParticipantPayload(BaseModel):
    participant_code: str | None = Field(default=None, min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool = True
    consent_completed: bool = False
    profile_completed: bool = False
    age: int | None = Field(default=None, ge=18, le=100)
    gender: str | None = Field(default=None, max_length=50)
    height_cm: float | None = Field(default=None, gt=50, le=250)
    weight_kg: float | None = Field(default=None, gt=20, le=350)
    education: str | None = Field(default=None, max_length=100)
    occupation: str | None = Field(default=None, max_length=100)
    smoking: Literal["never", "former", "current"] | None = None
    alcohol: Literal["none", "occasional", "regular"] | None = None
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    exercise_days_per_week: int | None = Field(default=None, ge=0, le=7)
    heart_disease: bool = False
    hypertension: bool = False
    diabetes: bool = False
    medication: str | None = Field(default=None, max_length=500)


class ManualSessionPayload(BaseModel):
    participant_id: str = Field(min_length=2, max_length=64)
    session_code: str | None = Field(default=None, min_length=2, max_length=32)
    condition: Literal["relaxed", "stress"]
    status: Literal["completed", "in_progress", "in-progress", "pending", "pending-review", "incomplete"] = "incomplete"
    task: str | None = Field(default=None, max_length=100)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    signal_quality: Literal["good", "moderate", "poor"] | None = None
    ecg_collected: bool = False
    heart_rate: float | None = Field(default=None, ge=20, le=240)
    hrv: float | None = Field(default=None, ge=0)
    eda: float | None = Field(default=None, ge=0)
    temperature: float | None = Field(default=None, ge=20, le=45)
    respiration: float | None = Field(default=None, ge=0, le=80)
    questionnaire_completed: bool = False
    questionnaire_score: float | None = Field(default=None, ge=0, le=100)
    doctor_assessment_completed: bool = False
    doctor_label: Literal["low", "moderate", "high", "severe"] | None = None


class DoctorAssessmentPayload(BaseModel):
    session_id: str
    clinical_stress_label: Literal["low", "moderate", "high", "severe"]
    comments: str | None = Field(default=None, max_length=1000)
    recommendation: str | None = Field(default=None, max_length=1000)


class AccessRequestReviewPayload(BaseModel):
    status: Literal["approved", "rejected"]
    review_note: str | None = Field(default=None, max_length=500)


def clean_document(document: dict | None) -> dict | None:
    if not document:
        return None
    return {key: (str(value) if isinstance(value, ObjectId) else value) for key, value in document.items()}


def normalize_quality(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.lower().strip().replace("_", "-")
    if normalized in {"good", "moderate", "poor"}:
        return normalized
    return None


def normalize_status(value: str | None) -> str:
    normalized = (value or "incomplete").lower().strip().replace("_", "-")
    return {
        "in_progress": "in-progress",
        "pending": "pending-review",
        "pending-review": "pending-review",
        "completed": "completed",
    }.get(normalized, normalized if normalized in {"completed", "in-progress", "pending-review", "incomplete"} else "incomplete")


def profile_document_from_payload(payload: ManualParticipantPayload, participant_id: ObjectId) -> dict:
    height = payload.height_cm
    weight = payload.weight_kg
    bmi = round(weight / ((height / 100) ** 2), 1) if height and weight else None
    return {
        "participant_id": participant_id,
        "age": payload.age,
        "gender": payload.gender,
        "height_cm": height,
        "weight_kg": weight,
        "bmi": bmi,
        "education": payload.education,
        "occupation": payload.occupation,
        "smoking": payload.smoking,
        "alcohol": payload.alcohol,
        "sleep_hours": payload.sleep_hours,
        "exercise_days_per_week": payload.exercise_days_per_week,
        "heart_disease": payload.heart_disease,
        "hypertension": payload.hypertension,
        "diabetes": payload.diabetes,
        "medication": payload.medication,
    }


def public_participant_row(person: dict, profile: dict | None, sessions: int = 0, completed: int = 0, latest: dict | None = None) -> dict:
    return {
        "id": str(person["_id"]),
        "participant_code": person.get("participant_code", ""),
        "name": person.get("name", ""),
        "email": person.get("email", ""),
        "sessions": sessions,
        "completed_sessions": completed,
        "consent_completed": person.get("consent_completed", False),
        "profile_completed": person.get("profile_completed", False),
        "age": profile.get("age") if profile else None,
        "gender": profile.get("gender") if profile else None,
        "height_cm": profile.get("height_cm") if profile else None,
        "weight_kg": profile.get("weight_kg") if profile else None,
        "bmi": profile.get("bmi") if profile else None,
        "education": profile.get("education") if profile else None,
        "occupation": profile.get("occupation") if profile else None,
        "smoking": profile.get("smoking") if profile else None,
        "alcohol": profile.get("alcohol") if profile else None,
        "sleep_hours": profile.get("sleep_hours") if profile else None,
        "exercise_days_per_week": profile.get("exercise_days_per_week") if profile else None,
        "heart_disease": profile.get("heart_disease") if profile else False,
        "hypertension": profile.get("hypertension") if profile else False,
        "diabetes": profile.get("diabetes") if profile else False,
        "medication": profile.get("medication") if profile else None,
        "last_session_at": latest.get("started_at") if latest else None,
        "is_active": person.get("is_active", True),
    }


async def resolve_participant(database: AsyncDatabase, participant_id: str) -> dict:
    lookup = {"_id": ObjectId(participant_id)} if ObjectId.is_valid(participant_id) else {"participant_code": participant_id.strip().upper()}
    participant = await database.participants.find_one({**lookup, **PARTICIPANT_ROLE_FILTER})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    return participant


async def public_session_row(database: AsyncDatabase, item: dict) -> dict:
    person = await database.participants.find_one({"_id": item.get("participant_id")})
    session_id = item["_id"]
    physiological = item.get("physiological") or await database.physiological.find_one({"session_id": session_id})
    questionnaire = item.get("questionnaire") or await database.questionnaire_responses.find_one({"session_id": session_id})
    assessment = item.get("doctor_assessment") or await database.doctor_assessments.find_one({"session_id": session_id})
    return {
        **item,
        "_id": str(session_id),
        "participant_id": str(item["participant_id"]),
        "participant_object_id": str(item["participant_id"]),
        "participant_code": (person or {}).get("participant_code", "Unknown"),
        "participant_name": (person or {}).get("name", "Unknown participant"),
        "physiological": {
            "heart_rate": (physiological or {}).get("heart_rate"),
            "hrv": (physiological or {}).get("hrv"),
            "eda": (physiological or {}).get("eda"),
            "temperature": (physiological or {}).get("temperature"),
            "respiration": (physiological or {}).get("respiration"),
        } if physiological else None,
        "signal_quality": (physiological or {}).get("signal_quality", item.get("signal_quality", "pending")),
        "collected": {
            "physiological": physiological is not None,
            "questionnaire": questionnaire is not None,
            "doctor_assessment": assessment is not None,
        },
        "stress_score": (questionnaire or {}).get("score"),
        "doctor_label": (assessment or {}).get("clinical_stress"),
    }


async def create_notification(
    database: AsyncDatabase,
    type_: str,
    title: str,
    message: str,
    related_id: ObjectId | None = None,
) -> None:
    if not hasattr(database, "notifications"):
        return

    await database.notifications.insert_one({
        "type": type_,
        "title": title,
        "message": message,
        "related_id": related_id,
        "created_at": utc_now(),
        "read": False,
    })


def access_setup_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def dashboard_setup_link(token: str, email: str) -> str:
    query = urlencode({"resetToken": token, "email": email})
    return f"{settings.frontend_url.rstrip('/')}/researcher/login?{query}"


async def send_dashboard_access_email(
    database: AsyncDatabase,
    participant: dict,
) -> None:
    token = secrets.token_urlsafe(32)
    now = utc_now()
    await database.password_reset_tokens.insert_one(
        {
            "participant_id": participant["_id"],
            "token_hash": access_setup_token_hash(token),
            "used": False,
            "created_at": now,
            "expires_at": now + timedelta(minutes=30),
        }
    )

    link = dashboard_setup_link(token, participant["email"])
    name = participant.get("name") or "there"
    text = (
        f"Hello {name},\n\n"
        "Your Stress Research Platform dashboard access request has been "
        "approved. Set your password using this link within 30 minutes:\n\n"
        f"{link}\n\n"
        "If the link expires, use Forgot password on the dashboard login page."
    )
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #172033;">
        <p>Hello {name},</p>
        <p>Your Stress Research Platform dashboard access request has been approved.</p>
        <p>
          <a href="{link}" style="display:inline-block;background:#173764;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Set dashboard password
          </a>
        </p>
        <p>This link expires in 30 minutes. If it expires, use Forgot password on the dashboard login page.</p>
      </body>
    </html>
    """
    await send_email(
        to_email=participant["email"],
        to_name=participant.get("name"),
        subject="Your dashboard access has been approved",
        text=text,
        html=html,
    )


async def sync_manual_session_children(database: AsyncDatabase, session: dict, payload: ManualSessionPayload) -> None:
    now = utc_now()
    session_id = session["_id"]
    update: dict = {"$set": {"updated_at": now}, "$unset": {}}

    if payload.ecg_collected or any(value is not None for value in (payload.heart_rate, payload.hrv, payload.eda, payload.temperature, payload.respiration)):
        physiological = {
            "condition": payload.condition,
            "ecg": [] if payload.ecg_collected else None,
            "heart_rate": payload.heart_rate,
            "hrv": payload.hrv,
            "eda": payload.eda,
            "temperature": payload.temperature,
            "respiration": payload.respiration,
            "signal_quality": payload.signal_quality or "good",
            "recorded_at": payload.started_at or now,
            "updated_at": now,
        }
        update["$set"]["physiological"] = physiological
        update["$set"]["signal_quality"] = physiological["signal_quality"]
    else:
        update["$unset"]["physiological"] = ""
        update["$set"]["signal_quality"] = "pending"

    if payload.questionnaire_completed:
        update["$set"]["questionnaire"] = {
            "condition": payload.condition,
            "answers": {},
            "score": payload.questionnaire_score,
            "submitted_at": payload.completed_at or payload.started_at or now,
            "updated_at": now,
        }
    else:
        update["$unset"]["questionnaire"] = ""

    if payload.doctor_assessment_completed:
        update["$set"]["doctor_assessment"] = {
            "clinical_stress": payload.doctor_label,
            "comments": "Manual dashboard entry",
            "recommendation": None,
            "created_at": payload.completed_at or payload.started_at or now,
            "updated_at": now,
        }
    else:
        update["$unset"]["doctor_assessment"] = ""

    if not update["$unset"]:
        update.pop("$unset")

    await database.sessions.update_one({"_id": session_id}, update)


@router.get("/summary")
async def summary(
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    participants = await database.participants.count_documents(PARTICIPANT_ROLE_FILTER)
    total_sessions = await database.sessions.count_documents({})
    completed = await database.sessions.count_documents({"status": "completed"})
    assessments = await database.sessions.count_documents({"doctor_assessment": {"$exists": True}})
    consented = await database.participants.count_documents({
        **PARTICIPANT_ROLE_FILTER,
        "consent_completed": True,
    })
    sensor_records = await database.sessions.count_documents({"physiological": {"$exists": True}})
    questionnaire_records = await database.sessions.count_documents({"questionnaire": {"$exists": True}})
    quality = {
        level: await database.sessions.count_documents({"physiological.signal_quality": level})
        for level in ("good", "moderate", "poor")
    }
    recent = await collect(database.sessions.find({}).sort("started_at", -1).limit(8))
    all_completed_sessions = await collect(database.sessions.find({"status": "completed"}))
    all_sessions = await collect(database.sessions.find({}))
    physiological = [item["physiological"] for item in all_sessions if item.get("physiological")]
    questionnaires = [item["questionnaire"] for item in all_sessions if item.get("questionnaire")]

    def average(items: list[dict], key: str) -> float:
        values = [item.get(key) for item in items if isinstance(item.get(key), (int, float))]
        return round(sum(values) / len(values), 2) if values else 0

    status_distribution = {
        state: await database.sessions.count_documents({"status": state})
        for state in ("completed", "in_progress", "pending")
    }
    condition_distribution = {
        condition: await database.sessions.count_documents({"condition": condition})
        for condition in ("relaxed", "stress")
    }

    required_conditions = {"relaxed", "stress"}
    completed_conditions_by_participant: dict[object, set[str]] = {}
    for session in all_completed_sessions:
        participant_id = session.get("participant_id")
        condition = str(session.get("condition", "")).lower()
        if participant_id and condition in required_conditions:
            completed_conditions_by_participant.setdefault(participant_id, set()).add(condition)
    completed_protocol_slots = sum(
        len(conditions.intersection(required_conditions))
        for conditions in completed_conditions_by_participant.values()
    )
    required_protocol_slots = participants * len(required_conditions)
    protocol_progress = round((completed_protocol_slots / required_protocol_slots * 100), 1) if required_protocol_slots else 0

    participant_ids = list({item.get("participant_id") for item in recent if item.get("participant_id")})
    people = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    codes = {item["_id"]: item.get("participant_code", "") for item in people}
    return {
        "metrics": {
            "participants": participants,
            "total_sessions": total_sessions,
            "completed_sessions": completed,
            "pending_reviews": max(completed - assessments, 0),
            "consented": consented,
            "sensor_records": sensor_records,
            "questionnaire_records": questionnaire_records,
            "required_protocol_slots": required_protocol_slots,
            "completed_protocol_slots": completed_protocol_slots,
        },
        "averages": {
            "heart_rate": average(physiological, "heart_rate"),
            "hrv": average(physiological, "hrv"),
            "temperature": average(physiological, "temperature"),
            "eda": average(physiological, "eda"),
            "stress_score": average(questionnaires, "score"),
        },
        "status_distribution": status_distribution,
        "condition_distribution": condition_distribution,
        "quality": quality,
        "collection_progress": protocol_progress,
        "recent_sessions": [{
            "id": str(item["_id"]),
            "session_code": item.get("session_code", str(item["_id"])),
            "participant_code": codes.get(item.get("participant_id"), "Unknown"),
            "condition": item.get("condition", ""),
            "status": item.get("status", ""),
            "started_at": item.get("started_at"),
            "signal_quality": item.get("signal_quality", "pending"),
        } for item in recent],
    }


@router.get("/participants")
async def search_participants(
    search: str = Query(default="", max_length=100),
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    query: dict = dict(PARTICIPANT_ROLE_FILTER)
    if search.strip():
        pattern = re.escape(search.strip())
        query = {
            "$and": [
                PARTICIPANT_ROLE_FILTER,
                {
                    "$or": [
                        {"participant_code": {"$regex": pattern, "$options": "i"}},
                        {"name": {"$regex": pattern, "$options": "i"}},
                        {"email": {"$regex": pattern, "$options": "i"}},
                    ]
                },
            ]
        }
    people = await collect(database.participants.find(query).sort("created_at", -1).limit(100))
    result = []
    for person in people:
        sessions = await database.sessions.count_documents({"participant_id": person["_id"]})
        completed = await database.sessions.count_documents({"participant_id": person["_id"], "status": "completed"})
        profile = person.get("profile")
        latest = await collect(
            database.sessions.find({"participant_id": person["_id"]}).sort("started_at", -1).limit(1)
        )
        result.append(public_participant_row(person, profile, sessions, completed, latest[0] if latest else None))
    return result


@router.post("/participants", status_code=201)
async def create_participant(
    payload: ManualParticipantPayload,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not payload.password:
        raise HTTPException(status_code=400, detail="Temporary password is required for a manual participant")
    now = utc_now()
    participant_code = (payload.participant_code or await generate_participant_code(database)).strip().upper()
    participant = {
        "email": payload.email.lower().strip(),
        "name": payload.name.strip(),
        "participant_code": participant_code,
        "password_hash": hash_password(payload.password),
        "role": "participant",
        "is_active": payload.is_active,
        "consent_completed": payload.consent_completed,
        "profile_completed": payload.profile_completed,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await database.participants.insert_one(participant)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="Email or participant ID already exists") from error

    profile = profile_document_from_payload(payload, result.inserted_id)
    profile.update({"created_at": now, "updated_at": now})
    await database.participants.update_one(
        {"_id": result.inserted_id},
        {"$set": {"profile": profile}},
    )
    await create_notification(
        database,
        "participant_registered",
        "New participant registered",
        f"{participant['participant_code']} / {participant['name']} was added to the study.",
        result.inserted_id,
    )
    saved = await database.participants.find_one({"_id": result.inserted_id})
    return public_participant_row(saved, saved.get("profile"))


@router.put("/participants/{participant_id}")
async def update_participant(
    participant_id: str,
    payload: ManualParticipantPayload,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(participant_id):
        raise HTTPException(status_code=400, detail="Invalid participant ID")
    object_id = ObjectId(participant_id)
    participant = await database.participants.find_one({"_id": object_id, **PARTICIPANT_ROLE_FILTER})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    now = utc_now()
    updates = {
        "email": payload.email.lower().strip(),
        "name": payload.name.strip(),
        "participant_code": (
            payload.participant_code
            or participant.get("participant_code")
            or await generate_participant_code(database)
        ).strip().upper(),
        "is_active": payload.is_active,
        "consent_completed": payload.consent_completed,
        "profile_completed": payload.profile_completed,
        "updated_at": now,
    }
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    try:
        await database.participants.update_one({"_id": object_id}, {"$set": updates})
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="Email or participant ID already exists") from error

    profile = profile_document_from_payload(payload, object_id)
    profile.update({"updated_at": now})
    await database.participants.update_one(
        {"_id": object_id},
        {"$set": {"profile": {**profile, "created_at": participant.get("profile", {}).get("created_at", now)}}},
    )
    saved = await database.participants.find_one({"_id": object_id})
    sessions = await database.sessions.count_documents({"participant_id": object_id})
    completed = await database.sessions.count_documents({"participant_id": object_id, "status": "completed"})
    latest = await collect(database.sessions.find({"participant_id": object_id}).sort("started_at", -1).limit(1))
    return public_participant_row(saved, saved.get("profile"), sessions, completed, latest[0] if latest else None)


@router.get("/participants/{participant_id}")
async def participant_detail(
    participant_id: str,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(participant_id):
        raise HTTPException(status_code=400, detail="Invalid participant ID")
    object_id = ObjectId(participant_id)
    participant = await database.participants.find_one({"_id": object_id, **PARTICIPANT_ROLE_FILTER})
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    profile = participant.get("profile")
    consent = participant.get("consent")
    session_items = await collect(
        database.sessions.find({"participant_id": object_id}).sort("started_at", -1)
    )
    session_details = []
    for item in session_items:
        session_id = item["_id"]
        physiological = item.get("physiological") or await database.physiological.find_one({"session_id": session_id})
        questionnaire = item.get("questionnaire") or await database.questionnaire_responses.find_one({"session_id": session_id})
        assessment = item.get("doctor_assessment") or await database.doctor_assessments.find_one({"session_id": session_id})
        session_details.append({
            "id": str(session_id),
            "session_code": item.get("session_code", str(session_id)),
            "condition": item.get("condition", ""),
            "status": item.get("status", ""),
            "started_at": item.get("started_at"),
            "completed_at": item.get("completed_at"),
            "duration_seconds": item.get("duration_seconds"),
            "signal_quality": (physiological or {}).get("signal_quality", item.get("signal_quality", "pending")),
            "collected": {
                "physiological": physiological is not None,
                "questionnaire": questionnaire is not None,
                "doctor_assessment": assessment is not None,
            },
            "stress_score": (questionnaire or {}).get("score"),
            "doctor_label": (assessment or {}).get("clinical_stress"),
        })
    return {
        "participant": {
            "id": str(participant["_id"]),
            "participant_code": participant.get("participant_code", ""),
            "name": participant.get("name", ""),
            "email": participant.get("email", ""),
            "is_active": participant.get("is_active", True),
            "created_at": participant.get("created_at"),
            "consent_completed": participant.get("consent_completed", False),
            "profile_completed": participant.get("profile_completed", False),
        },
        "profile": ({key: (str(value) if isinstance(value, ObjectId) else value) for key, value in profile.items()} if profile else None),
        "consent": ({
            "accepted": consent.get("accepted", False),
            "version": consent.get("version", ""),
            "recorded_at": consent.get("recorded_at"),
        } if consent else None),
        "sessions": session_details,
    }


@router.get("/sessions")
async def sessions(
    participant_id: str | None = None,
    condition: str | None = None,
    status: str | None = None,
    search: str = Query(default="", max_length=100),
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    query = {}
    if participant_id:
        if not ObjectId.is_valid(participant_id):
            raise HTTPException(status_code=400, detail="Invalid participant ID")
        query["participant_id"] = ObjectId(participant_id)
    if condition:
        query["condition"] = condition
    if status:
        query["status"] = status
    items = await collect(database.sessions.find(query).sort("started_at", -1).limit(200))
    results = []
    for item in items:
        person = await database.participants.find_one({"_id": item.get("participant_id")})
        search_text = f"{item.get('session_code', '')} {(person or {}).get('participant_code', '')} {(person or {}).get('name', '')}"
        if search.strip() and search.lower().strip() not in search_text.lower():
            continue
        results.append(await public_session_row(database, item))
    return results


@router.post("/sessions", status_code=201)
async def create_manual_session(
    payload: ManualSessionPayload,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    participant = await resolve_participant(database, payload.participant_id)
    now = utc_now()
    session_count = await database.sessions.count_documents({"participant_id": participant["_id"]})
    status_value = payload.status.replace("-", "_")
    if status_value == "pending_review":
        status_value = "pending"
    document = {
        "participant_id": participant["_id"],
        "session_code": (payload.session_code or f"S{session_count + 1:02d}").strip().upper(),
        "condition": payload.condition,
        "task": payload.task,
        "status": status_value,
        "started_at": payload.started_at or now,
        "completed_at": payload.completed_at,
        "duration_seconds": payload.duration_seconds,
        "signal_quality": payload.signal_quality or "pending",
        "created_at": now,
        "updated_at": now,
    }
    result = await database.sessions.insert_one(document)
    document["_id"] = result.inserted_id
    await sync_manual_session_children(database, document, payload)
    await create_notification(
        database,
        "research_session_created",
        "New research session created",
        f"{document['session_code']} was created for {participant.get('participant_code', 'participant')}.",
        result.inserted_id,
    )
    saved = await database.sessions.find_one({"_id": result.inserted_id})
    return await public_session_row(database, saved)


@router.put("/sessions/{session_id}")
async def update_manual_session(
    session_id: str,
    payload: ManualSessionPayload,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    object_id = ObjectId(session_id)
    existing = await database.sessions.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    participant = await resolve_participant(database, payload.participant_id)
    now = utc_now()
    status_value = payload.status.replace("-", "_")
    if status_value == "pending_review":
        status_value = "pending"
    updates = {
        "participant_id": participant["_id"],
        "session_code": (payload.session_code or existing.get("session_code") or str(object_id)).strip().upper(),
        "condition": payload.condition,
        "task": payload.task,
        "status": status_value,
        "started_at": payload.started_at or existing.get("started_at") or now,
        "completed_at": payload.completed_at,
        "duration_seconds": payload.duration_seconds,
        "signal_quality": payload.signal_quality or "pending",
        "updated_at": now,
    }
    await database.sessions.update_one({"_id": object_id}, {"$set": updates})
    saved = await database.sessions.find_one({"_id": object_id})
    await sync_manual_session_children(database, saved, payload)
    saved = await database.sessions.find_one({"_id": object_id})
    return await public_session_row(database, saved)


@router.get("/sessions/{session_id}")
async def session_detail(
    session_id: str,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    object_id = ObjectId(session_id)
    session = await database.sessions.find_one({"_id": object_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    participant = await database.participants.find_one({"_id": session.get("participant_id")})
    physiological = session.get("physiological") or await database.physiological.find_one({"session_id": object_id})
    questionnaire = session.get("questionnaire") or await database.questionnaire_responses.find_one({"session_id": object_id})
    assessment = session.get("doctor_assessment") or await database.doctor_assessments.find_one({"session_id": object_id})

    return {
        "session": clean_document(session),
        "participant": {
            "id": str((participant or {}).get("_id", "")),
            "participant_code": (participant or {}).get("participant_code", "Unknown"),
            "name": (participant or {}).get("name", "Unknown participant"),
        },
        "physiological": clean_document(physiological),
        "questionnaire": clean_document(questionnaire),
        "doctor_assessment": clean_document(assessment),
    }


@router.get("/exports/{filename}")
async def export_csv(
    filename: str,
    condition: Literal["relaxed", "stress"] | None = None,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> Response:
    if filename not in EXPORTS:
        raise HTTPException(status_code=404, detail="Unknown export dataset")
    loader, fields = EXPORTS[filename]
    rows = await loader(database)
    if condition:
        rows = [row for row in rows if str(row.get("Condition") or row.get("condition") or "").lower() == condition]
    content = csv_response_content(rows, fields)
    await create_notification(
        database,
        "export_completed",
        "Export completed",
        f"{filename} was generated successfully.",
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/physiological")
async def physiological_records(
    search: str = Query(default="", max_length=100),
    quality: str | None = None,
    condition: str | None = None,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    query: dict = {}
    if quality:
        query["physiological.signal_quality"] = quality
    query["physiological"] = {"$exists": True}
    sessions = await collect(database.sessions.find(query).sort("physiological.recorded_at", -1).limit(500))
    participant_ids = list({item.get("participant_id") for item in sessions if item.get("participant_id")})
    people = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    participant_map = {item["_id"]: item for item in people}

    results = []
    for session in sessions:
        item = session.get("physiological") or {}
        person = participant_map.get(session.get("participant_id"), {})
        session_condition = session.get("condition", item.get("condition", "relaxed"))
        if condition and session_condition != condition:
            continue
        search_text = f"{person.get('participant_code', '')} {session.get('session_code', '')}"
        if search.strip() and search.lower().strip() not in search_text.lower():
            continue
        results.append({
            "id": str(session["_id"]),
            "participant_id": person.get("participant_code", str(session.get("participant_id", ""))),
            "session_id": session.get("session_code", str(session["_id"])),
            "condition": session_condition,
            "ecg_collected": bool(item.get("ecg")),
            "heart_rate": item.get("heart_rate"),
            "hrv": item.get("hrv"),
            "eda": item.get("eda"),
            "temperature": item.get("temperature"),
            "respiration": item.get("respiration"),
            "accelerometer": bool(item.get("accelerometer") or item.get("acc")),
            "battery": item.get("battery"),
            "sampling_rate": item.get("sampling_rate"),
            "signal_quality": normalize_quality(item.get("signal_quality")),
            "recorded_at": item.get("recorded_at"),
        })
    return results


@router.get("/notifications")
async def notifications(
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    notifications = await collect(database.notifications.find({}).sort("created_at", -1).limit(50))
    return [{
        "id": str(item["_id"]),
        "type": item.get("type", "info"),
        "title": item.get("title", "Notification"),
        "message": item.get("message", ""),
        "related_id": str(item.get("related_id", "")) if item.get("related_id") else None,
        "created_at": item.get("created_at"),
        "read": item.get("read", False),
    } for item in notifications]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    result = await database.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True, "read_at": utc_now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "updated"}


@router.post("/doctor", status_code=201)
async def save_dashboard_doctor_assessment(
    payload: DoctorAssessmentPayload,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(payload.session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session_id = ObjectId(payload.session_id)
    session = await database.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    now = utc_now()
    document = {
        "clinical_stress": payload.clinical_stress_label,
        "comments": payload.comments,
        "recommendation": payload.recommendation,
        "created_at": now,
        "updated_at": now,
    }
    await database.sessions.update_one(
        {"_id": session_id},
        {"$set": {"doctor_assessment": document, "updated_at": now}},
    )
    await create_notification(
        database,
        "doctor_assessment_completed",
        "Doctor assessment completed",
        f"Clinical label saved for {session.get('session_code', payload.session_id)}.",
        session_id,
    )
    saved_session = await database.sessions.find_one({"_id": session_id})
    saved = (saved_session or {}).get("doctor_assessment", {})
    participant = await database.participants.find_one({"_id": session["participant_id"]})
    return {
        "id": str(session_id),
        "participant_id": (participant or {}).get("participant_code", str(session["participant_id"])),
        "session_id": session.get("session_code", payload.session_id),
        "condition": session.get("condition", "relaxed"),
        "clinical_stress_label": saved.get("clinical_stress"),
        "comments": saved.get("comments"),
        "recommendation": saved.get("recommendation"),
        "status": "completed",
    }


@router.get("/questionnaires")
async def questionnaire_records(
    search: str = Query(default="", max_length=100),
    condition: str | None = None,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    sessions = await collect(database.sessions.find({"questionnaire": {"$exists": True}}).sort("questionnaire.submitted_at", -1).limit(500))
    participant_ids = list({item.get("participant_id") for item in sessions if item.get("participant_id")})
    people = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    participant_map = {item["_id"]: item for item in people}

    results = []
    for session in sessions:
        item = session.get("questionnaire") or {}
        person = participant_map.get(session.get("participant_id"), {})
        session_condition = session.get("condition", item.get("condition", "relaxed"))
        if condition and session_condition != condition:
            continue
        search_text = f"{person.get('participant_code', '')} {session.get('session_code', '')}"
        if search.strip() and search.lower().strip() not in search_text.lower():
            continue
        answers = item.get("answers") or {}
        results.append({
            "id": str(session["_id"]),
            "participant_id": person.get("participant_code", str(session.get("participant_id", ""))),
            "session_id": session.get("session_code", str(session["_id"])),
            "condition": session_condition,
            "questionnaire_key": item.get("questionnaire_key"),
            "answers": answers,
            "mood": answers.get("mood") or answers.get("current_mood"),
            "stress": answers.get("stress") or answers.get("current_stress"),
            "sleep": answers.get("sleep"),
            "fatigue": answers.get("fatigue"),
            "physical": answers.get("physical"),
            "lifestyle": answers.get("lifestyle"),
            "score": item.get("score"),
            "timestamp": item.get("submitted_at") or item.get("created_at"),
            "completed": item.get("score") is not None,
        })
    return results


@router.get("/doctor")
async def doctor_assessments(
    search: str = Query(default="", max_length=100),
    status: str | None = None,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    sessions = await collect(database.sessions.find({}).sort("started_at", -1).limit(500))
    participant_ids = list({item.get("participant_id") for item in sessions if item.get("participant_id")})
    people = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    participant_map = {item["_id"]: item for item in people}

    results = []
    for session in sessions:
        assessment = session.get("doctor_assessment")
        person = participant_map.get(session.get("participant_id"), {})
        item_status = "completed" if assessment else "pending"
        if status and item_status != status:
            continue
        search_text = f"{person.get('participant_code', '')} {session.get('session_code', '')}"
        if search.strip() and search.lower().strip() not in search_text.lower():
            continue
        results.append({
            "id": str(session["_id"]),
            "session_record_id": str(session["_id"]),
            "participant_id": person.get("participant_code", str(session.get("participant_id", ""))),
            "session_id": session.get("session_code", str(session["_id"])),
            "condition": session.get("condition", "relaxed"),
            "clinical_stress_label": (assessment or {}).get("clinical_stress"),
            "comments": (assessment or {}).get("comments"),
            "recommendation": (assessment or {}).get("recommendation"),
            "status": item_status,
        })
    return results


@router.get("/access-requests")
async def list_access_requests(
    _: dict = Depends(require_super_admin),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    requests: list[dict] = []

    cursor = database.dashboard_access_requests.find().sort(
        "requested_at",
        -1,
    )

    async for item in cursor:
        requested_at = item.get("requested_at") or item.get("created_at")
        reviewed_at = item.get("reviewed_at")

        requests.append(
            {
                "id": str(item["_id"]),
                "requestCode": item.get("request_code"),
                "name": item.get("name", ""),
                "email": item.get("email", ""),
                "organization": item.get("organization", ""),
                "requestedRole": item.get("requested_role", "viewer"),
                "reason": item.get("reason", ""),
                "status": item.get("status", "pending"),
                "emailVerified": item.get("email_verified", False),
                "createdAt": (
                    requested_at.isoformat()
                    if requested_at
                    else None
                ),
                "reviewedAt": (
                    reviewed_at.isoformat()
                    if reviewed_at
                    else None
                ),
                "reviewNote": item.get("review_note"),
            }
        )

    return requests


@router.patch("/access-requests/{request_id}")
async def review_access_request(
    request_id: str,
    payload: AccessRequestReviewPayload,
    reviewer: dict = Depends(require_super_admin),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    request = await database.dashboard_access_requests.find_one(
        {"_id": ObjectId(request_id)}
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    now = utc_now()
    email = str(request.get("email", "")).lower().strip()
    requested_role = request.get("requested_role", "viewer")
    participant = await database.participants.find_one({"email": email})

    if payload.status == "approved":
        account_updates = {
            "email": email,
            "name": request.get("name", "Dashboard user"),
            "role": requested_role,
            "is_active": True,
            "approval_status": "approved",
            "approved_at": now,
            "email_verified": True,
            "email_verified_at": now,
            "consent_completed": True,
            "profile_completed": True,
            "updated_at": now,
        }

        if participant:
            await database.participants.update_one(
                {"_id": participant["_id"]},
                {"$set": account_updates},
            )
            participant.update(account_updates)
        else:
            participant = {
                **account_updates,
                "participant_code": await generate_participant_code(
                    database,
                    prefix="R",
                ),
                "password_hash": hash_password(
                    secrets.token_urlsafe(24)
                ),
                "created_at": now,
            }
            result = await database.participants.insert_one(participant)
            participant["_id"] = result.inserted_id

        await send_dashboard_access_email(database, participant)

    await database.dashboard_access_requests.update_one(
        {"_id": request["_id"]},
        {
            "$set": {
                "status": payload.status,
                "reviewed_by": reviewer.get("_id"),
                "review_note": payload.review_note,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    return {
        "id": request_id,
        "status": payload.status,
        "message": (
            "Access request approved"
            if payload.status == "approved"
            else "Access request declined"
        ),
    }


@router.delete("/access-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_access_request(
    request_id: str,
    _: dict = Depends(require_super_admin),
    database: AsyncDatabase = Depends(get_database),
) -> Response:
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    result = await database.dashboard_access_requests.delete_one(
        {"_id": ObjectId(request_id)}
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
