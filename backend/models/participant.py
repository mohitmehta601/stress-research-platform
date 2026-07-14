PARTICIPANT_COLLECTION = "participants"

PARTICIPANT_INDEXES = [
    {"keys": [("email", 1)], "unique": True},
    {"keys": [("participant_code", 1)], "unique": True},
]
