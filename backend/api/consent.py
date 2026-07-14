from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from backend.app.config import get_settings
from backend.database.mongodb import get_database, utc_now
from backend.schemas.participant import ConsentRequest, ConsentResponse
from backend.services.auth import get_current_participant

router = APIRouter(prefix="/consents", tags=["consents"])
settings = get_settings()


@router.get("/current", response_model=ConsentResponse)
async def current_consent(
    participant: dict = Depends(get_current_participant),
) -> dict:
    consent = participant.get("consent")
    if consent and consent.get("version") != settings.consent_version:
        consent = None
    if not consent:
        raise HTTPException(status_code=404, detail="No consent decision has been recorded")
    return {**consent, "participant_id": str(participant["_id"])}


@router.post("/decision", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
async def record_consent(
    payload: ConsentRequest,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    recorded_at = utc_now()
    consent = {
        "version": settings.consent_version,
        "accepted": payload.accepted,
        "recorded_at": recorded_at,
    }
    await database.participants.update_one(
        {"_id": participant["_id"]},
        {"$set": {"consent": consent, "consent_completed": payload.accepted, "updated_at": recorded_at}},
    )
    return {**consent, "participant_id": str(participant["_id"])}
