from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    participant_id: str
    session_type: Literal["relaxed", "stress"]
    stress_score: int = Field(ge=1, le=10)


class SessionResponse(SessionCreate):
    id: str
    started_at: datetime
    completed_at: datetime | None = None
