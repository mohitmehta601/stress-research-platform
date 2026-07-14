from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from backend.app.config import get_settings

settings = get_settings()
client: AsyncMongoClient = AsyncMongoClient(settings.mongodb_uri)
database: AsyncDatabase = client[settings.mongodb_database]


async def connect_to_mongo() -> None:
    """Verify that MongoDB is available during application startup."""
    await client.admin.command("ping")


async def close_mongo_connection() -> None:
    """Close the shared MongoDB client during application shutdown."""
    await client.close()


def get_database() -> AsyncDatabase:
    return database


async def ensure_indexes() -> None:
    await database.participants.create_index("email", unique=True)
    await database.participants.create_index("participant_code", unique=True)
    await database.participants.create_index("role")
    await database.participants.create_index("consent.version")
    await database.sessions.create_index([("participant_id", 1), ("started_at", -1)])
    await database.sessions.create_index("physiological.recorded_at")
    await database.sessions.create_index("questionnaire.submitted_at")
    await database.sessions.create_index("doctor_assessment.created_at")
    await database.notifications.create_index("created_at")
    await database.password_reset_tokens.create_index("token_hash", unique=True)
    await database.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if document is None:
        return None
    result = dict(document)
    if isinstance(result.get("_id"), ObjectId):
        result["id"] = str(result.pop("_id"))
    return result
