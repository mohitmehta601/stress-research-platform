from datetime import datetime

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ParticipantCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class ParticipantResponse(BaseModel):
    id: str
    email: EmailStr
    participant_code: str
    name: str
    is_active: bool = True
    created_at: datetime


class ConsentRequest(BaseModel):
    accepted: bool


class ConsentResponse(BaseModel):
    participant_id: str
    version: str
    accepted: bool
    recorded_at: datetime


class ProfileUpdate(BaseModel):
    age: int = Field(ge=18, le=100)
    gender: str = Field(min_length=1, max_length=50)
    height_cm: float = Field(gt=50, le=250)
    weight_kg: float = Field(gt=20, le=350)
    education: str = Field(min_length=1, max_length=100)
    occupation: str = Field(min_length=1, max_length=100)
    smoking: Literal["never", "former", "current"]
    alcohol: Literal["none", "occasional", "regular"]
    sleep_hours: float = Field(ge=0, le=24)
    exercise_days_per_week: int = Field(ge=0, le=7)
    heart_disease: bool = False
    hypertension: bool = False
    diabetes: bool = False
    medication: str | None = Field(default=None, max_length=500)


class ProfileResponse(ProfileUpdate):
    participant_id: str
    bmi: float
    updated_at: datetime


class OnboardingStatus(BaseModel):
    participant_id: str
    participant_code: str
    consent_completed: bool
    profile_completed: bool
    next_step: Literal["consent", "profile", "dashboard"]
