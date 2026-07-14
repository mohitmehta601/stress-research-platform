from backend.services.auth import next_step


def onboarding_status(participant: dict) -> dict:
    return {
        "participant_id": str(participant["_id"]),
        "participant_code": participant["participant_code"],
        "consent_completed": participant.get("consent_completed", False),
        "profile_completed": participant.get("profile_completed", False),
        "next_step": next_step(participant),
    }
