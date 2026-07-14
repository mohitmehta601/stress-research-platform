from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.asynchronous.database import AsyncDatabase

from backend.database.mongodb import get_database, utc_now
from backend.services.auth import require_researcher

router = APIRouter(prefix="/doctors", tags=["doctors"])


class DoctorAssessmentCreate(BaseModel):
    session_id: str
    clinical_stress: Literal["Low", "Moderate", "High", "Severe", "low", "moderate", "high", "severe"]
    comments: str | None = Field(default=None, max_length=1000)
    recommendation: str | None = Field(default=None, max_length=1000)


@router.get("/status")
async def doctor_status() -> dict[str, str]:
    return {"service": "doctors", "status": "ready"}


@router.post("/assessments", status_code=status.HTTP_201_CREATED)
async def save_assessment(
    payload: DoctorAssessmentCreate,
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
        "clinical_stress": payload.clinical_stress.lower(),
        "comments": payload.comments,
        "recommendation": payload.recommendation,
        "created_at": now,
        "updated_at": now,
    }
    await database.sessions.update_one(
        {"_id": session_id},
        {"$set": {"doctor_assessment": document, "updated_at": now}},
    )
    await database.notifications.insert_one({
        "type": "doctor_assessment_completed",
        "title": "Doctor assessment completed",
        "message": f"Clinical label saved for {session.get('session_code', payload.session_id)}.",
        "related_id": session_id,
        "created_at": now,
        "read": False,
    })
    return {"status": "saved", "session_id": payload.session_id, "clinical_stress": payload.clinical_stress.lower()}


@router.get("/assessments/{session_id}")
async def get_assessment(
    session_id: str,
    _: dict = Depends(require_researcher),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session = await database.sessions.find_one({"_id": ObjectId(session_id)})
    assessment = (session or {}).get("doctor_assessment")
    if not assessment:
        raise HTTPException(status_code=404, detail="Doctor assessment not found")
    return {
        "id": session_id,
        "session_id": session_id,
        "participant_id": str((session or {}).get("participant_id", "")),
        "clinical_stress": assessment.get("clinical_stress"),
        "comments": assessment.get("comments"),
        "recommendation": assessment.get("recommendation"),
        "created_at": assessment.get("created_at"),
        "updated_at": assessment.get("updated_at"),
    }
