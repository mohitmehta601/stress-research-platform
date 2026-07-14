import argparse
import os

from dotenv import load_dotenv
from pymongo import MongoClient


OLD_COLLECTIONS = [
    "_connection_tests",
    "audio_records",
    "consents",
    "doctor_assessments",
    "physiological",
    "profiles",
    "questionnaire_responses",
]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge legacy MongoDB collections into compact app collections."
    )
    parser.add_argument(
        "--drop-old",
        action="store_true",
        help="Drop legacy collections after their data has been merged.",
    )
    args = parser.parse_args()

    load_dotenv("backend/.env")

    uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    database_name = os.getenv("MONGODB_DATABASE", "stress_research_platform")

    client = MongoClient(uri)
    database = client[database_name]

    print(f"Database: {database_name}")

    migrated_profiles = 0
    for profile in database.profiles.find({}):
        participant_id = profile.get("participant_id")
        if not participant_id:
            continue

        embedded = {
            key: value
            for key, value in profile.items()
            if key not in {"_id", "participant_id"}
        }
        database.participants.update_one(
            {"_id": participant_id},
            {"$set": {"profile": embedded, "profile_completed": True}},
        )
        migrated_profiles += 1

    migrated_consents = 0
    for consent in database.consents.find({}).sort("recorded_at", 1):
        participant_id = consent.get("participant_id")
        if not participant_id:
            continue

        embedded = {
            key: value
            for key, value in consent.items()
            if key not in {"_id", "participant_id"}
        }
        database.participants.update_one(
            {"_id": participant_id},
            {
                "$set": {
                    "consent": embedded,
                    "consent_completed": bool(consent.get("accepted")),
                }
            },
        )
        migrated_consents += 1

    migrated_physiological = 0
    for record in database.physiological.find({}):
        session_id = record.get("session_id")
        if not session_id:
            continue

        embedded = {
            key: value
            for key, value in record.items()
            if key not in {"_id", "session_id", "participant_id"}
        }
        update = {"physiological": embedded}
        if embedded.get("signal_quality"):
            update["signal_quality"] = embedded["signal_quality"]
        database.sessions.update_one({"_id": session_id}, {"$set": update})
        migrated_physiological += 1

    migrated_questionnaires = 0
    for response in database.questionnaire_responses.find({}):
        session_id = response.get("session_id")
        if not session_id:
            continue

        embedded = {
            key: value
            for key, value in response.items()
            if key not in {"_id", "session_id", "participant_id"}
        }
        database.sessions.update_one(
            {"_id": session_id},
            {"$set": {"questionnaire": embedded}},
        )
        migrated_questionnaires += 1

    migrated_assessments = 0
    for assessment in database.doctor_assessments.find({}):
        session_id = assessment.get("session_id")
        if not session_id:
            continue

        embedded = {
            key: value
            for key, value in assessment.items()
            if key not in {"_id", "session_id", "participant_id"}
        }
        database.sessions.update_one(
            {"_id": session_id},
            {"$set": {"doctor_assessment": embedded}},
        )
        migrated_assessments += 1

    migrated_audio = 0
    for audio in database.audio_records.find({}):
        session_id = audio.get("session_id")
        if not session_id:
            continue

        embedded = {
            key: value
            for key, value in audio.items()
            if key not in {"_id", "session_id", "participant_id"}
        }
        database.sessions.update_one(
            {"_id": session_id},
            {"$push": {"audio_records": embedded}},
        )
        migrated_audio += 1

    print("Merged legacy data")
    print(f"- profiles -> participants.profile: {migrated_profiles}")
    print(f"- consents -> participants.consent: {migrated_consents}")
    print(f"- physiological -> sessions.physiological: {migrated_physiological}")
    print(f"- questionnaire_responses -> sessions.questionnaire: {migrated_questionnaires}")
    print(f"- doctor_assessments -> sessions.doctor_assessment: {migrated_assessments}")
    print(f"- audio_records -> sessions.audio_records: {migrated_audio}")

    if args.drop_old:
        for collection_name in OLD_COLLECTIONS:
            if collection_name in database.list_collection_names():
                database.drop_collection(collection_name)
                print(f"Dropped legacy collection: {collection_name}")
    else:
        print("Legacy collections were kept. Re-run with --drop-old to remove them.")

    remaining = sorted(database.list_collection_names())
    print("Collections now:")
    for collection_name in remaining:
        print(f"- {collection_name}: {database[collection_name].count_documents({})}")

    client.close()


if __name__ == "__main__":
    main()
