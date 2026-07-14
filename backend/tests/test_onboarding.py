import unittest
from types import SimpleNamespace
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from backend.database.mongodb import get_database
from backend.main import app
from backend.services.auth import hash_password


class FakeCollection:
    def __init__(self, unique_field=None):
        self.documents = []
        self.unique_field = unique_field

    @staticmethod
    def _matches(document, query):
        for key, value in query.items():
            if key == "$or":
                if not any(FakeCollection._matches(document, option) for option in value):
                    return False
                continue
            actual = document.get(key)
            if isinstance(value, dict):
                if "$ne" in value and actual == value["$ne"]:
                    return False
                if "$in" in value and actual not in value["$in"]:
                    return False
                if "$gt" in value and not (actual and actual > value["$gt"]):
                    return False
                if "$regex" in value:
                    import re
                    flags = re.IGNORECASE if "i" in value.get("$options", "") else 0
                    if not re.search(value["$regex"], str(actual or ""), flags):
                        return False
            elif actual != value:
                return False
        return True

    async def find_one(self, query):
        return next((doc.copy() for doc in self.documents if self._matches(doc, query)), None)

    def find(self, query):
        return FakeCursor([doc.copy() for doc in self.documents if self._matches(doc, query)])

    async def count_documents(self, query):
        return sum(1 for doc in self.documents if self._matches(doc, query))

    async def insert_one(self, document):
        if self.unique_field and any(
            item.get(self.unique_field) == document.get(self.unique_field) for item in self.documents
        ):
            raise DuplicateKeyError("duplicate")
        stored = document.copy()
        stored["_id"] = ObjectId()
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def update_one(self, query, update, upsert=False):
        existing = next((doc for doc in self.documents if self._matches(doc, query)), None)
        if existing is None and upsert:
            existing = {**query, "_id": ObjectId()}
            self.documents.append(existing)
        if existing is not None:
            existing.update(update.get("$set", {}))
        return SimpleNamespace(matched_count=int(existing is not None))


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field, direction):
        self.documents.sort(key=lambda item: item.get(field) or "", reverse=direction < 0)
        return self

    def limit(self, amount):
        self.documents = self.documents[:amount]
        return self

    def __aiter__(self):
        self.iterator = iter(self.documents)
        return self

    async def __anext__(self):
        try:
            return next(self.iterator)
        except StopIteration as error:
            raise StopAsyncIteration from error


class FakeDatabase:
    def __init__(self):
        self.participants = FakeCollection(unique_field="email")
        self.consents = FakeCollection()
        self.profiles = FakeCollection()
        self.sessions = FakeCollection()
        self.physiological = FakeCollection()
        self.questionnaire_responses = FakeCollection()
        self.doctor_assessments = FakeCollection()
        self.password_reset_tokens = FakeCollection(unique_field="token_hash")
        self.dashboard_access_requests = FakeCollection()

    def __getitem__(self, name):
        return getattr(self, name)


async def noop():
    return None


async def noop_args(*_):
    return None


async def noop_kwargs(*_, **__):
    return None


class OnboardingFlowTest(unittest.TestCase):
    def setUp(self):
        self.database = FakeDatabase()
        app.dependency_overrides[get_database] = lambda: self.database
        self.patches = [
            patch("backend.main.connect_to_mongo", noop),
            patch("backend.main.ensure_indexes", noop),
            patch("backend.main.close_mongo_connection", noop),
            patch("backend.main.bootstrap_researcher", noop_args),
            patch("backend.api.auth.send_email", noop_kwargs),
            patch("backend.api.auth.generate_otp_code", lambda: "123456"),
        ]
        for item in self.patches:
            item.start()
        self.client_context = TestClient(app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        app.dependency_overrides.clear()
        for item in self.patches:
            item.stop()

    def test_complete_participant_onboarding(self):
        register = self.client.post("/api/auth/register", json={
            "name": "Demo Participant",
            "email": "demo@pulselab.org",
            "password": "secure-password",
        })
        self.assertEqual(register.status_code, 201, register.text)
        self.assertTrue(register.json()["requires_otp"])
        verify_registration = self.client.post("/api/auth/verify-registration-otp", json={
            "otp_token": register.json()["otp_token"], "otp_code": "123456"
        })
        self.assertEqual(verify_registration.status_code, 200, verify_registration.text)
        auth = verify_registration.json()
        self.assertEqual(auth["participant"]["next_step"], "consent")
        self.assertEqual(auth["participant"]["participant_code"], "P001")
        self.assertEqual(auth["participant"]["role"], "participant")
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        duplicate = self.client.post("/api/auth/register", json={
            "name": "Duplicate", "email": "demo@pulselab.org", "password": "secure-password"
        })
        self.assertEqual(duplicate.status_code, 409)

        profile_payload = {
            "age": 29, "gender": "Woman", "height_cm": 165, "weight_kg": 60,
            "education": "Postgraduate", "occupation": "Researcher", "smoking": "never",
            "alcohol": "occasional", "sleep_hours": 7.5, "exercise_days_per_week": 3,
            "heart_disease": False, "hypertension": False, "diabetes": False,
            "medication": None,
        }
        blocked = self.client.put("/api/profiles/me", json=profile_payload, headers=headers)
        self.assertEqual(blocked.status_code, 403)

        consent = self.client.post(
            "/api/consents/decision", json={"accepted": True}, headers=headers
        )
        self.assertEqual(consent.status_code, 201, consent.text)

        profile = self.client.put("/api/profiles/me", json=profile_payload, headers=headers)
        self.assertEqual(profile.status_code, 200, profile.text)
        self.assertEqual(profile.json()["bmi"], 22.0)

        status_response = self.client.get("/api/profiles/onboarding", headers=headers)
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.json()["next_step"], "dashboard")

        login = self.client.post("/api/auth/login", json={
            "email": "demo@pulselab.org", "password": "secure-password"
        })
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["participant"]["next_step"], "dashboard")

    def test_research_dashboard_and_exports_are_role_protected(self):
        self.database.participants.documents.append({
            "_id": ObjectId(), "name": "Research Administrator",
            "email": "researcher@stressplatform.dev", "participant_code": "R0001",
            "password_hash": hash_password("ChangeMe123!"), "role": "researcher",
            "is_active": True, "consent_completed": True, "profile_completed": True,
        })
        participant_register = self.client.post("/api/auth/register", json={
            "name": "Study Participant", "email": "study@pulselab.org", "password": "secure-password"
        }).json()
        participant = self.client.post("/api/auth/verify-registration-otp", json={
            "otp_token": participant_register["otp_token"], "otp_code": "123456"
        }).json()
        participant_headers = {"Authorization": f"Bearer {participant['access_token']}"}
        denied = self.client.get("/api/dashboard/summary", headers=participant_headers)
        self.assertEqual(denied.status_code, 403)

        researcher_login = self.client.post("/api/auth/login", json={
            "email": "researcher@stressplatform.dev", "password": "ChangeMe123!"
        })
        self.assertEqual(researcher_login.status_code, 200, researcher_login.text)
        headers = {"Authorization": f"Bearer {researcher_login.json()['access_token']}"}

        participant_document = next(
            item for item in self.database.participants.documents if item["email"] == "study@pulselab.org"
        )
        session_id = ObjectId()
        self.database.sessions.documents.append({
            "_id": session_id, "session_code": "S01",
            "participant_id": participant_document["_id"], "condition": "relaxed",
            "status": "completed", "signal_quality": "good",
            "started_at": participant_document["created_at"],
        })
        self.database.physiological.documents.append({
            "_id": ObjectId(), "session_id": session_id,
            "participant_id": participant_document["_id"], "ecg": [1, 2],
            "hrv": 48.0, "eda": 2.35, "temperature": 36.6, "signal_quality": "good",
        })

        summary = self.client.get("/api/dashboard/summary", headers=headers)
        self.assertEqual(summary.status_code, 200, summary.text)
        self.assertEqual(summary.json()["metrics"]["participants"], 1)
        self.assertEqual(summary.json()["metrics"]["completed_sessions"], 1)

        detail = self.client.get(
            f"/api/dashboard/participants/{participant_document['_id']}", headers=headers
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["participant"]["participant_code"], participant["participant"]["participant_code"])
        self.assertTrue(detail.json()["sessions"][0]["collected"]["physiological"])

        export = self.client.get("/api/dashboard/exports/final_dataset.csv", headers=headers)
        self.assertEqual(export.status_code, 200, export.text)
        self.assertIn("Participant,Session,Condition,ECG,HRV,EDA,Temp,Questionnaire,Doctor Label", export.text)
        self.assertIn("S01,relaxed,True,True,True,True,False", export.text)

    def test_dashboard_access_request_requires_email_otp(self):
        request = self.client.post("/api/auth/dashboard-access-requests", json={
            "name": "Clinical Viewer",
            "email": "viewer@pulselab.org",
            "organization": "Pulse Lab",
            "requestedRole": "viewer",
            "reason": "I need to review anonymized study dashboard data.",
        })
        self.assertEqual(request.status_code, 201, request.text)
        self.assertTrue(request.json()["requires_otp"])
        self.assertEqual(len(self.database.dashboard_access_requests.documents), 0)

        verified = self.client.post("/api/auth/dashboard-access-requests/verify-otp", json={
            "otp_token": request.json()["otp_token"], "otp_code": "123456"
        })
        self.assertEqual(verified.status_code, 201, verified.text)
        self.assertEqual(verified.json()["status"], "pending")
        self.assertEqual(len(self.database.dashboard_access_requests.documents), 1)
        self.assertTrue(self.database.dashboard_access_requests.documents[0]["email_verified"])


if __name__ == "__main__":
    unittest.main()
