from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    otp_token: str = Field(min_length=32)
    otp_code: str = Field(pattern=r"^\d{6}$")


class ParticipantAuthResponse(BaseModel):
    id: str
    email: EmailStr
    participant_code: str
    name: str
    role: str
    consent_completed: bool
    profile_completed: bool
    next_step: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    participant: ParticipantAuthResponse
