import hashlib
import random
import secrets
from datetime import timedelta
from typing import Literal
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from backend.database.mongodb import get_database, utc_now
from backend.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    VerifyOtpRequest,
)
from backend.app.config import get_settings
from backend.services.email import send_email
from backend.services.auth import (
    create_access_token,
    create_refresh_token,
    generate_participant_code,
    get_current_participant,
    hash_password,
    participant_from_refresh_token,
    public_participant,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
LOGIN_OTP_TTL_MINUTES = 10


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32)
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class DashboardAccessRequestCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    organization: str = Field(min_length=2, max_length=150)
    requested_role: Literal["viewer", "researcher", "doctor"] = Field(
        alias="requestedRole"
    )
    reason: str = Field(min_length=10, max_length=500)


class DashboardAccessOtpResponse(BaseModel):
    id: str
    request_code: str
    status: str
    message: str


def token_payload(participant: dict) -> dict:
    participant_id = str(participant["_id"])

    return {
        "access_token": create_access_token(participant_id),
        "refresh_token": create_refresh_token(participant_id),
        "participant": public_participant(participant),
    }


def set_auth_cookie(response: Response, payload: dict) -> None:
    response.set_cookie(
        key="srp_access_token",
        value=payload["access_token"],
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def otp_hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def generate_otp_code() -> str:
    return f"{random.SystemRandom().randint(0, 999999):06d}"


def reset_base_url(participant: dict) -> str:
    role = participant.get("role", "participant")
    if role == "participant":
        return settings.mobile_url.rstrip("/")
    return f"{settings.frontend_url.rstrip('/')}/researcher/login"


def reset_link(participant: dict, token: str) -> str:
    query = urlencode(
        {
            "resetToken": token,
            "email": participant.get("email", ""),
        }
    )
    return f"{reset_base_url(participant)}?{query}"


async def send_password_reset_email(participant: dict, token: str) -> None:
    link = reset_link(participant, token)
    name = participant.get("name") or "there"
    subject = "Reset your Stress Research Platform password"
    text = (
        f"Hello {name},\n\n"
        "We received a request to reset your Stress Research Platform "
        "password. Use this link within 30 minutes:\n\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #172033;">
        <p>Hello {name},</p>
        <p>We received a request to reset your Stress Research Platform password.</p>
        <p>
          <a href="{link}" style="display:inline-block;background:#173764;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Reset password
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </body>
    </html>
    """
    await send_email(
        to_email=participant["email"],
        to_name=participant.get("name"),
        subject=subject,
        text=text,
        html=html,
    )


async def send_otp_email(
    *,
    to_email: str,
    to_name: str | None,
    code: str,
    purpose_text: str,
) -> None:
    subject = "Verification code"
    text = (
        f"Your Stress Research Platform verification code is {code}. "
        f"It expires in {LOGIN_OTP_TTL_MINUTES} minutes."
    )
    html = f"""
    <html>
      <body>
        <p>Your Stress Research Platform verification code is <strong>{code}</strong>.</p>
        <p>This code expires in {LOGIN_OTP_TTL_MINUTES} minutes.</p>
      </body>
    </html>
    """
    await send_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        text=text,
        html=html,
    )


async def create_otp_challenge(
    database: AsyncDatabase,
    *,
    email: str,
    name: str | None,
    purpose: str,
    purpose_text: str,
    participant_id=None,
    payload: dict | None = None,
) -> dict:
    now = utc_now()
    code = generate_otp_code()
    otp_token = secrets.token_urlsafe(32)
    document = {
        "purpose": purpose,
        "token_hash": token_hash(otp_token),
        "otp_hash": otp_hash(code),
        "used": False,
        "created_at": now,
        "expires_at": now + timedelta(minutes=LOGIN_OTP_TTL_MINUTES),
    }
    if participant_id is not None:
        document["participant_id"] = participant_id
    if payload is not None:
        document["payload"] = payload
    await database.password_reset_tokens.insert_one(document)
    await send_otp_email(
        to_email=email,
        to_name=name,
        code=code,
        purpose_text=purpose_text,
    )
    response = {
        "requires_otp": True,
        "otp_token": otp_token,
        "email": email,
        "expires_in_seconds": LOGIN_OTP_TTL_MINUTES * 60,
        "message": "Verification code sent to your email.",
    }
    return response


async def create_participant_otp(
    database: AsyncDatabase,
    participant: dict,
    purpose: Literal["registration_otp"],
) -> dict:
    return await create_otp_challenge(
        database,
        email=participant["email"],
        name=participant.get("name"),
        purpose=purpose,
        purpose_text="complete your participant sign-up",
        participant_id=participant["_id"],
    )


async def find_valid_otp(
    database: AsyncDatabase,
    *,
    purpose: str,
    otp_token: str,
    otp_code: str,
) -> dict:
    now = utc_now()
    record = await database.password_reset_tokens.find_one(
        {
            "purpose": purpose,
            "token_hash": token_hash(otp_token),
            "used": False,
            "expires_at": {"$gt": now},
        }
    )
    if not record or record.get("otp_hash") != otp_hash(otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )
    return record


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=None)
async def register(
    payload: RegisterRequest,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    email = payload.email.lower().strip()
    now = utc_now()

    document = {
        "email": email,
        "name": payload.name.strip(),
        "participant_code": await generate_participant_code(database),
        "password_hash": hash_password(payload.password),
        "is_active": True,
        "role": "participant",
        "email_verified": False,
        "approval_status": "approved",
        "consent_completed": False,
        "profile_completed": False,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = await database.participants.insert_one(document)
    except DuplicateKeyError as error:
        existing = await database.participants.find_one({"email": email})
        if existing and not existing.get("email_verified", False):
            await database.participants.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "name": payload.name.strip(),
                        "password_hash": hash_password(payload.password),
                        "is_active": True,
                        "role": "participant",
                        "approval_status": "approved",
                        "updated_at": now,
                    }
                },
            )
            existing.update(
                {
                    "name": payload.name.strip(),
                    "password_hash": document["password_hash"],
                    "is_active": True,
                    "role": "participant",
                    "approval_status": "approved",
                    "updated_at": now,
                }
            )
            return await create_participant_otp(
                database,
                existing,
                "registration_otp",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from error

    document["_id"] = result.inserted_id
    return await create_participant_otp(
        database,
        document,
        "registration_otp",
    )


@router.post("/verify-registration-otp", response_model=TokenResponse)
async def verify_registration_otp(
    payload: VerifyOtpRequest,
    response: Response,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    now = utc_now()
    record = await find_valid_otp(
        database,
        purpose="registration_otp",
        otp_token=payload.otp_token,
        otp_code=payload.otp_code,
    )
    participant = await database.participants.find_one(
        {"_id": record["participant_id"]}
    )

    if not participant or not participant.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    await database.password_reset_tokens.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "used": True,
                "used_at": now,
            }
        },
    )
    await database.participants.update_one(
        {"_id": participant["_id"]},
        {
            "$set": {
                "email_verified": True,
                "updated_at": now,
            }
        },
    )
    participant["email_verified"] = True
    auth_payload = token_payload(participant)
    set_auth_cookie(response, auth_payload)
    return auth_payload


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    email = payload.email.lower().strip()

    participant = await database.participants.find_one(
        {"email": email}
    )

    if (
        not participant
        or not verify_password(
            payload.password,
            participant["password_hash"],
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not participant.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive",
        )

    role = participant.get("role", "participant")

    if (
        role != "participant"
        and role != "super_admin"
        and participant.get("approval_status", "approved") != "approved"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your dashboard access request has not been approved",
        )

    auth_payload = token_payload(participant)
    set_auth_cookie(response, auth_payload)
    return auth_payload


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    response: Response,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    participant = await participant_from_refresh_token(
        payload.refresh_token,
        database,
    )

    auth_payload = token_payload(participant)
    set_auth_cookie(response, auth_payload)
    return auth_payload


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    database: AsyncDatabase = Depends(get_database),
) -> dict[str, str]:
    email = payload.email.lower().strip()
    participant = await database.participants.find_one({"email": email})

    if participant and participant.get("is_active", True):
        token = secrets.token_urlsafe(32)
        now = utc_now()
        await database.password_reset_tokens.insert_one(
            {
                "participant_id": participant["_id"],
                "token_hash": token_hash(token),
                "used": False,
                "created_at": now,
                "expires_at": now + timedelta(minutes=30),
            }
        )
        await send_password_reset_email(participant, token)

    return {
        "status": "accepted",
        "message": (
            "If this email exists, password reset instructions "
            "will be sent."
        ),
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    database: AsyncDatabase = Depends(get_database),
) -> dict[str, str]:
    now = utc_now()
    reset = await database.password_reset_tokens.find_one(
        {
            "token_hash": token_hash(payload.token),
            "used": False,
            "expires_at": {"$gt": now},
        }
    )

    if not reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or expired",
        )

    participant = await database.participants.find_one(
        {"_id": reset["participant_id"]}
    )

    if not participant or not participant.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or expired",
        )

    await database.participants.update_one(
        {"_id": participant["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.password),
                "updated_at": now,
            }
        },
    )
    await database.password_reset_tokens.update_one(
        {"_id": reset["_id"]},
        {
            "$set": {
                "used": True,
                "used_at": now,
            }
        },
    )

    return {
        "status": "updated",
        "message": "Your password has been updated.",
    }


@router.post(
    "/dashboard-access-requests",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
)
async def create_dashboard_access_request(
    payload: DashboardAccessRequestCreate,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    email = payload.email.lower().strip()

    existing_account = await database.participants.find_one(
        {
            "email": email,
            "role": {
                "$in": [
                    "viewer",
                    "researcher",
                    "doctor",
                    "admin",
                    "super_admin",
                ]
            },
        }
    )

    if existing_account:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with dashboard access already exists",
        )

    existing_request = (
        await database.dashboard_access_requests.find_one(
            {
                "email": email,
                "status": {
                    "$in": [
                        "pending",
                        "approved",
                    ]
                },
            }
        )
    )

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An active access request already exists "
                "for this email"
            ),
        )

    pending_request = {
        "name": payload.name.strip(),
        "email": email,
        "organization": payload.organization.strip(),
        "requested_role": payload.requested_role,
        "reason": payload.reason.strip(),
    }

    return await create_otp_challenge(
        database,
        email=email,
        name=pending_request["name"],
        purpose="dashboard_access_otp",
        purpose_text="verify your dashboard access request",
        payload=pending_request,
    )


@router.post(
    "/dashboard-access-requests/verify-otp",
    response_model=DashboardAccessOtpResponse,
    status_code=status.HTTP_201_CREATED,
)
async def verify_dashboard_access_request_otp(
    payload: VerifyOtpRequest,
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    now = utc_now()
    record = await find_valid_otp(
        database,
        purpose="dashboard_access_otp",
        otp_token=payload.otp_token,
        otp_code=payload.otp_code,
    )
    pending_request = record.get("payload") or {}
    email = str(pending_request.get("email", "")).lower().strip()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    existing_request = await database.dashboard_access_requests.find_one(
        {
            "email": email,
            "status": {"$in": ["pending", "approved"]},
        }
    )
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active access request already exists for this email",
        )

    document = {
        "request_code": f"AR-{uuid4().hex[:10].upper()}",
        "name": str(pending_request.get("name", "")).strip(),
        "email": email,
        "organization": str(pending_request.get("organization", "")).strip(),
        "requested_role": pending_request.get("requested_role", "viewer"),
        "reason": str(pending_request.get("reason", "")).strip(),
        "status": "pending",
        "email_verified": True,
        "email_verified_at": now,
        "reviewed_by": None,
        "review_note": None,
        "requested_at": now,
        "reviewed_at": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await database.dashboard_access_requests.insert_one(document)
    await database.password_reset_tokens.update_one(
        {"_id": record["_id"]},
        {"$set": {"used": True, "used_at": now}},
    )

    return {
        "id": str(result.inserted_id),
        "request_code": document["request_code"],
        "status": document["status"],
        "message": (
            "Your dashboard access request has been "
            "submitted successfully."
        ),
    }


@router.get("/me")
async def me(
    participant: dict = Depends(get_current_participant),
) -> dict:
    return public_participant(participant)
