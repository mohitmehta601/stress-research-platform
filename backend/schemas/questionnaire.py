from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class QuestionnaireCreate(BaseModel):
    participant_id: str
    questionnaire_key: str = Field(min_length=1, max_length=64)
    answers: dict[str, Any]


class QuestionnaireResponse(QuestionnaireCreate):
    id: str
    submitted_at: datetime
