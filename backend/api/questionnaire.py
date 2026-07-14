from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from pymongo.asynchronous.database import AsyncDatabase

from backend.database.mongodb import get_database, utc_now
from backend.services.auth import get_current_participant

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


class QuestionnaireSubmit(BaseModel):
    session_id: str
    questionnaire_key: str = Field(default="post-session-v1", min_length=1, max_length=64)
    answers: dict[str, Any]
    score: float | None = None


@router.get("/status")
async def questionnaire_status() -> dict[str, str]:
    return {"service": "questionnaires", "status": "ready"}


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_questionnaire(
    payload: QuestionnaireSubmit,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not ObjectId.is_valid(payload.session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    session_id = ObjectId(payload.session_id)
    session = await database.sessions.find_one({"_id": session_id, "participant_id": participant["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    values = [value for value in payload.answers.values() if isinstance(value, (int, float))]
    score = payload.score if payload.score is not None else (round(sum(values), 2) if values else None)
    now = utc_now()
    document = {
        "condition": session.get("condition"),
        "questionnaire_key": payload.questionnaire_key,
        "answers": payload.answers,
        "score": score,
        "submitted_at": now,
        "updated_at": now,
    }
    await database.sessions.update_one(
        {"_id": session_id},
        {"$set": {"questionnaire": document, "updated_at": now}},
    )
    await database.notifications.insert_one({
        "type": "questionnaire_submitted",
        "title": "Questionnaire submitted",
        "message": f"Questionnaire response saved for {session.get('session_code', payload.session_id)}.",
        "related_id": session_id,
        "created_at": now,
        "read": False,
    })
    return {
        "status": "saved",
        "session_id": payload.session_id,
        "score": score,
        "submitted_at": now,
    }
