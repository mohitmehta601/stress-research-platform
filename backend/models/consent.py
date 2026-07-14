CONSENT_COLLECTION = "consents"

CONSENT_INDEXES = [
    {"keys": [("participant_id", 1), ("version", 1)], "unique": True},
]
