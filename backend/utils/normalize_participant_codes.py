"""Normalize participant codes to P001, P002, ...

Run from project root:
    python -m backend.utils.normalize_participant_codes
"""

from __future__ import annotations

import asyncio
from pymongo import UpdateOne
from pymongo.asynchronous.mongo_client import AsyncMongoClient

from backend.app.config import get_settings


async def main() -> None:
    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri)
    database = client[settings.mongodb_database]

    participants = []
    cursor = database.participants.find({"role": {"$ne": "researcher"}}).sort("created_at", 1)
    async for participant in cursor:
        participants.append(participant)

    temporary_operations = []
    final_operations = []
    for index, participant in enumerate(participants, start=1):
        next_code = f"P{index:03d}"
        if participant.get("participant_code") != next_code:
            temporary_operations.append(
                UpdateOne(
                    {"_id": participant["_id"]},
                    {"$set": {"participant_code": f"TMP-{participant['_id']}"}},
                )
            )
            final_operations.append(
                UpdateOne({"_id": participant["_id"]}, {"$set": {"participant_code": next_code}})
            )

    if temporary_operations:
        await database.participants.bulk_write(temporary_operations, ordered=True)
        await database.participants.bulk_write(final_operations, ordered=True)

    print(f"Normalized {len(final_operations)} participant code(s).")
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
