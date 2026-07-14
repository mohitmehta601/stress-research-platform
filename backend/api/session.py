from datetime import timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.asynchronous.database import AsyncDatabase

from backend.database.mongodb import get_database, utc_now
from backend.services.auth import get_current_participant

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    condition: Literal["relaxed", "stress"]
    task: str | None = Field(default=None, max_length=100)


class PhysiologicalCreate(BaseModel):
    ecg: list[float] | None = None
    heart_rate: float | None = None
    hrv: float | None = None
    eda: float | None = None
    temperature: float | None = None
    respiration: float | None = None
    accelerometer: dict[str, Any] | None = None
    battery: float | None = None
    sampling_rate: float | None = None
    signal_quality: Literal["good", "moderate", "poor"] = "good"


def public_session(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "session_code": document.get("session_code", str(document["_id"])),
        "participant_id": str(document["participant_id"]),
        "condition": document.get("condition"),
        "status": document.get("status"),
        "task": document.get("task"),
        "started_at": document.get("started_at"),
        "completed_at": document.get("completed_at"),
        "duration_seconds": document.get("duration_seconds"),
    }


def as_aware_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get("/status")
async def session_status() -> dict[str, str]:
    return {"service": "sessions", "status": "ready"}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if participant.get("role") != "participant":
        raise HTTPException(status_code=403, detail="Participant access is required")
    if not participant.get("consent_completed") or not participant.get("profile_completed"):
        raise HTTPException(status_code=403, detail="Consent and profile are required before sessions")

    count = await database.sessions.count_documents({"participant_id": participant["_id"]})
    now = utc_now()
    document = {
        "participant_id": participant["_id"],
        "session_code": f"S{count + 1:02d}",
        "condition": payload.condition,
        "task": payload.task,
        "status": "in_progress",
        "started_at": now,
        "created_at": now,
        "updated_at": now,
    }
    result = await database.sessions.insert_one(document)
    document["_id"] = result.inserted_id
    await database.notifications.insert_one({
        "type": "research_session_created",
        "title": "New research session created",
        "message": f"{document['session_code']} started by {participant.get('participant_code', 'participant')}.",
        "related_id": result.inserted_id,
        "created_at": now,
        "read": False,
    })
    return public_session(document)


@router.get("/me")
async def my_sessions(
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> list[dict]:
    cursor = database.sessions.find({"participant_id": participant["_id"]}).sort("started_at", -1)
    results = []
    async for item in cursor:
        physiological = item.get("physiological")
        questionnaire = item.get("questionnaire")
        assessment = item.get("doctor_assessment")
        document = public_session(item)
        document.update({
            "signal_quality": (physiological or {}).get("signal_quality", item.get("signal_quality", "pending")),
            "collected": {
                "physiological": physiological is not None,
                "questionnaire": questionnaire is not None,
                "doctor_assessment": assessment is not None,
            },
            "physiological": {
                "hrv": (physiological or {}).get("hrv"),
                "eda": (physiological or {}).get("eda"),
                "temperature": (physiological or {}).get("temperature"),
            } if physiological else None,
        })
        results.append(document)
    return results


@router.post("/{session_id}/physiological", status_code=status.HTTP_201_CREATED)
async def save_physiological(
    session_id: str,
    payload: PhysiologicalCreate,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    from bson import ObjectId

    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session = await database.sessions.find_one({"_id": ObjectId(session_id), "participant_id": participant["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = utc_now()
    document = payload.model_dump()
    document.update({
        "recorded_at": now,
        "updated_at": now,
    })
    await database.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "physiological": document,
            "signal_quality": payload.signal_quality,
            "updated_at": now,
        }},
    )
    await database.notifications.insert_one({
        "type": "physiological_data_uploaded",
        "title": "Physiological data uploaded",
        "message": f"Sensor readings saved for {session.get('session_code', session_id)}.",
        "related_id": session["_id"],
        "created_at": now,
        "read": False,
    })
    return {"status": "saved", "session_id": session_id}


@router.post("/{session_id}/complete")
async def complete_session(
    session_id: str,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    from bson import ObjectId

    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session = await database.sessions.find_one({"_id": ObjectId(session_id), "participant_id": participant["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    now = utc_now()
    started_at = as_aware_utc(session.get("started_at"))
    duration = int((now - started_at).total_seconds()) if started_at else None
    await database.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"status": "completed", "completed_at": now, "duration_seconds": duration, "updated_at": now}},
    )
    updated = await database.sessions.find_one({"_id": session["_id"]})
    return public_session(updated)
