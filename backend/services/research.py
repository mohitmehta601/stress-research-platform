import csv
import io
import json
from datetime import date, datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

PARTICIPANT_ROLE_FILTER = {"role": "participant"}


def serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str, separators=(",", ":"))
    return value


async def collect(cursor) -> list[dict]:
    return [document async for document in cursor]


def csv_response_content(rows: list[dict], preferred_fields: list[str]) -> str:
    fields = preferred_fields.copy()
    for row in rows:
        for key in row:
            if key not in fields:
                fields.append(key)
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows({key: serialize(value) for key, value in row.items()} for row in rows)
    return output.getvalue()


async def participant_rows(database: AsyncDatabase) -> list[dict]:
    participants = await collect(database.participants.find(PARTICIPANT_ROLE_FILTER))
    rows = []
    for item in participants:
        profile = item.get("profile") or {}
        rows.append({
            "ParticipantID": item.get("participant_code", ""),
            "ParticipantObjectID": str(item.get("_id", "")),
            "Name": item.get("name", ""),
            "Email": item.get("email", ""),
            "Age": profile.get("age", ""),
            "Gender": profile.get("gender", ""),
            "HeightCm": profile.get("height_cm", ""),
            "WeightKg": profile.get("weight_kg", ""),
            "BMI": profile.get("bmi", ""),
            "Education": profile.get("education", ""),
            "Occupation": profile.get("occupation", ""),
            "Smoking": profile.get("smoking", ""),
            "Alcohol": profile.get("alcohol", ""),
            "SleepHours": profile.get("sleep_hours", ""),
            "ExerciseDaysPerWeek": profile.get("exercise_days_per_week", ""),
            "HeartDisease": profile.get("heart_disease", ""),
            "Hypertension": profile.get("hypertension", ""),
            "Diabetes": profile.get("diabetes", ""),
            "Medication": profile.get("medication", ""),
            "ConsentCompleted": item.get("consent_completed", False),
            "ProfileCompleted": item.get("profile_completed", False),
            "CreatedAt": item.get("created_at", ""),
        })
    return rows


async def session_rows(database: AsyncDatabase) -> list[dict]:
    sessions = await collect(database.sessions.find({}).sort("started_at", -1))
    participants = await collect(database.participants.find({}))
    codes = {item["_id"]: item.get("participant_code", "") for item in participants}
    return [{
        "SessionID": item.get("session_code", str(item.get("_id", ""))),
        "SessionObjectID": str(item.get("_id", "")),
        "ParticipantID": codes.get(item.get("participant_id"), ""),
        "ParticipantObjectID": str(item.get("participant_id", "")),
        "Condition": item.get("condition", ""),
        "Task": item.get("task", ""),
        "Status": item.get("status", ""),
        "SignalQuality": item.get("signal_quality", ""),
        "StartedAt": item.get("started_at", ""),
        "CompletedAt": item.get("completed_at", ""),
        "DurationSeconds": item.get("duration_seconds", ""),
    } for item in sessions]


async def collection_rows(database: AsyncDatabase, collection_name: str) -> list[dict]:
    rows = await collect(database[collection_name].find({}))
    return [{("id" if key == "_id" else key): value for key, value in row.items()} for row in rows]


async def physiological_rows(database: AsyncDatabase) -> list[dict]:
    sessions = await collect(database.sessions.find({"physiological": {"$exists": True}}).sort("physiological.recorded_at", -1))
    participant_ids = list({item.get("participant_id") for item in sessions if item.get("participant_id")})
    participants = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    participant_map = {item["_id"]: item for item in participants}
    rows = []
    for session in sessions:
        item = session.get("physiological") or {}
        participant = participant_map.get(session.get("participant_id"), {})
        rows.append({
            "ParticipantID": participant.get("participant_code", str(session.get("participant_id", ""))),
            "SessionID": session.get("session_code", str(session.get("_id", ""))),
            "Condition": session.get("condition", item.get("condition", "")),
            "ECG": item.get("ecg", ""),
            "HeartRate": item.get("heart_rate", ""),
            "HRV": item.get("hrv", ""),
            "EDA": item.get("eda", ""),
            "Temperature": item.get("temperature", ""),
            "Respiration": item.get("respiration", ""),
            "Accelerometer": item.get("accelerometer") or item.get("acc", ""),
            "Battery": item.get("battery", ""),
            "SamplingRate": item.get("sampling_rate", ""),
            "SignalQuality": item.get("signal_quality", ""),
            "RecordedAt": item.get("recorded_at", ""),
        })
    return rows


async def questionnaire_rows(database: AsyncDatabase) -> list[dict]:
    sessions = await collect(database.sessions.find({"questionnaire": {"$exists": True}}).sort("questionnaire.submitted_at", -1))
    participant_ids = list({item.get("participant_id") for item in sessions if item.get("participant_id")})
    participants = await collect(database.participants.find({"_id": {"$in": participant_ids}})) if participant_ids else []
    participant_map = {item["_id"]: item for item in participants}
    rows = []
    for session in sessions:
        item = session.get("questionnaire") or {}
        participant = participant_map.get(session.get("participant_id"), {})
        answers = item.get("answers") or {}
        row = {
            "ParticipantID": participant.get("participant_code", str(session.get("participant_id", ""))),
            "SessionID": session.get("session_code", str(session.get("_id", ""))),
            "Condition": session.get("condition", item.get("condition", "")),
            "QuestionnaireKey": item.get("questionnaire_key", ""),
            "Score": item.get("score", ""),
            "SubmittedAt": item.get("submitted_at", ""),
            "Answers": answers,
        }
        for question_id, answer in answers.items():
            if isinstance(answer, dict):
                row[f"{question_id}_raw"] = answer.get("raw_score", "")
                row[f"{question_id}_score"] = answer.get("scored_value", "")
                row[f"{question_id}_question"] = answer.get("question", "")
                row[f"{question_id}_section"] = answer.get("section", "")
            else:
                row[str(question_id)] = answer
        rows.append(row)
    return rows


async def doctor_rows(database: AsyncDatabase) -> list[dict]:
    sessions = await collect(database.sessions.find({"doctor_assessment": {"$exists": True}}).sort("doctor_assessment.created_at", -1))
    rows = []
    for session in sessions:
        assessment = session.get("doctor_assessment") or {}
        rows.append({
            "id": str(session.get("_id", "")),
            "session_id": str(session.get("_id", "")),
            "participant_id": str(session.get("participant_id", "")),
            "clinical_stress": assessment.get("clinical_stress", ""),
            "comments": assessment.get("comments", ""),
            "recommendation": assessment.get("recommendation", ""),
            "created_at": assessment.get("created_at", ""),
            "updated_at": assessment.get("updated_at", ""),
        })
    return rows


async def final_dataset_rows(database: AsyncDatabase) -> list[dict]:
    sessions = await collect(database.sessions.find({}).sort("started_at", -1))
    participants = await collect(database.participants.find({}))
    legacy_physiological = await collect(database.physiological.find({}))
    legacy_questionnaires = await collect(database.questionnaire_responses.find({}))
    legacy_assessments = await collect(database.doctor_assessments.find({}))
    phys_by_session = {item["session_id"]: item for item in legacy_physiological if item.get("session_id")}
    questionnaire_by_session = {item["session_id"]: item for item in legacy_questionnaires if item.get("session_id")}
    assessment_by_session = {item["session_id"]: item for item in legacy_assessments if item.get("session_id")}
    people = {item["_id"]: item for item in participants}
    rows = []
    for session in sessions:
        session_id = session["_id"]
        participant = people.get(session.get("participant_id"), {})
        profile = participant.get("profile") or {}
        signals = session.get("physiological") or phys_by_session.get(session_id, {})
        questionnaire = session.get("questionnaire") or questionnaire_by_session.get(session_id, {})
        assessment = session.get("doctor_assessment") or assessment_by_session.get(session_id, {})
        answers = questionnaire.get("answers", {}) or {}
        rows.append({
            "Participant": participant.get("participant_code", ""),
            "Session": session.get("session_code", str(session_id)),
            "ECG": bool(signals.get("ecg")),
            "Temp": signals.get("temperature") is not None,
            "Questionnaire": bool(questionnaire),
            "Doctor Label": assessment.get("clinical_stress", ""),
            "ParticipantID": participant.get("participant_code", ""),
            "ParticipantName": participant.get("name", ""),
            "ParticipantEmail": participant.get("email", ""),
            "Age": profile.get("age", ""),
            "Gender": profile.get("gender", ""),
            "HeightCm": profile.get("height_cm", ""),
            "WeightKg": profile.get("weight_kg", ""),
            "BMI": profile.get("bmi", ""),
            "Education": profile.get("education", ""),
            "Occupation": profile.get("occupation", ""),
            "SessionID": session.get("session_code", str(session_id)),
            "SessionObjectID": str(session_id),
            "Condition": session.get("condition", ""),
            "SessionStatus": session.get("status", ""),
            "StartedAt": session.get("started_at", ""),
            "CompletedAt": session.get("completed_at", ""),
            "DurationSeconds": session.get("duration_seconds", ""),
            "SignalQuality": signals.get("signal_quality", session.get("signal_quality", "")),
            "ECGCollected": bool(signals.get("ecg")),
            "HeartRate": signals.get("heart_rate", ""),
            "HRV": signals.get("hrv") is not None,
            "EDA": signals.get("eda") is not None,
            "Temperature": signals.get("temperature", ""),
            "Respiration": signals.get("respiration", ""),
            "Battery": signals.get("battery", ""),
            "SamplingRate": signals.get("sampling_rate", ""),
            "QuestionnaireCompleted": bool(questionnaire),
            "QuestionnaireKey": questionnaire.get("questionnaire_key", ""),
            "QuestionnaireScore": questionnaire.get("score", ""),
            "QuestionnaireAnswers": answers,
            "Mood": answers.get("mood") or answers.get("current_mood", ""),
            "Stress": answers.get("stress") or answers.get("current_stress", ""),
            "Sleep": answers.get("sleep", ""),
            "Fatigue": answers.get("fatigue", ""),
            "Physical": answers.get("physical", ""),
            "Lifestyle": answers.get("lifestyle", ""),
            "DoctorAssessmentCompleted": bool(assessment),
            "DoctorLabel": assessment.get("clinical_stress", ""),
            "DoctorComments": assessment.get("comments", ""),
            "DoctorRecommendation": assessment.get("recommendation", ""),
        })
    return rows


EXPORTS = {
    "participant.csv": (participant_rows, ["ParticipantID", "ParticipantObjectID", "Name", "Email", "Age", "Gender", "HeightCm", "WeightKg", "BMI", "Education", "Occupation"]),
    "participant_profile.csv": (participant_rows, ["ParticipantID", "Name", "Email", "Age", "Gender", "HeightCm", "WeightKg", "BMI", "Education", "Occupation"]),
    "session.csv": (session_rows, ["SessionID", "SessionObjectID", "ParticipantID", "ParticipantObjectID", "Condition", "Task", "Status", "SignalQuality", "StartedAt", "CompletedAt", "DurationSeconds"]),
    "research_sessions.csv": (session_rows, ["SessionID", "SessionObjectID", "ParticipantID", "Condition", "Task", "Status", "StartedAt", "CompletedAt", "DurationSeconds"]),
    "physiological.csv": (physiological_rows, ["ParticipantID", "SessionID", "Condition", "ECG", "HeartRate", "HRV", "EDA", "Temperature", "Respiration", "Accelerometer", "Battery", "SamplingRate", "SignalQuality", "RecordedAt"]),
    "questionnaire.csv": (questionnaire_rows, ["ParticipantID", "SessionID", "Condition", "QuestionnaireKey", "Score", "SubmittedAt", "Answers"]),
    "doctor.csv": (doctor_rows, ["id", "session_id", "participant_id", "clinical_stress", "comments", "recommendation", "created_at", "updated_at"]),
    "doctor_assessment.csv": (doctor_rows, ["id", "session_id", "participant_id", "clinical_stress", "comments", "recommendation", "created_at", "updated_at"]),
    "final_dataset.csv": (final_dataset_rows, ["Participant", "Session", "Condition", "ECG", "HRV", "EDA", "Temp", "Questionnaire", "Doctor Label", "ParticipantID", "ParticipantName", "ParticipantEmail", "Age", "Gender", "SessionID", "SessionStatus", "StartedAt", "CompletedAt", "HeartRate", "Temperature", "Respiration", "QuestionnaireScore", "QuestionnaireAnswers", "DoctorLabel", "DoctorComments", "DoctorRecommendation"]),
}
