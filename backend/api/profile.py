from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.asynchronous.database import AsyncDatabase

from backend.database.mongodb import get_database, utc_now
from backend.schemas.participant import OnboardingStatus, ProfileResponse, ProfileUpdate
from backend.services.auth import get_current_participant
from backend.services.onboarding import onboarding_status

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/onboarding", response_model=OnboardingStatus)
async def get_onboarding_status(
    participant: dict = Depends(get_current_participant),
) -> dict:
    return onboarding_status(participant)


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    participant: dict = Depends(get_current_participant),
) -> dict:
    profile = participant.get("profile")
    if not profile:
        raise HTTPException(status_code=404, detail="Profile has not been completed")
    return {**profile, "participant_id": str(participant["_id"])}


@router.put("/me", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
async def save_profile(
    payload: ProfileUpdate,
    participant: dict = Depends(get_current_participant),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    if not participant.get("consent_completed", False):
        raise HTTPException(status_code=403, detail="Research consent is required first")
    updated_at = utc_now()
    profile = payload.model_dump()
    profile.update({
        "bmi": round(payload.weight_kg / ((payload.height_cm / 100) ** 2), 1),
        "updated_at": updated_at,
    })
    await database.participants.update_one(
        {"_id": participant["_id"]},
        {"$set": {"profile": profile, "profile_completed": True, "updated_at": updated_at}},
    )
    return {**profile, "participant_id": str(participant["_id"])}
