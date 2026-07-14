from datetime import datetime, timedelta, timezone

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from pymongo.asynchronous.database import AsyncDatabase

from backend.app.config import get_settings
from backend.database.mongodb import get_database

settings = get_settings()
password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_prefix}/auth/login",
    auto_error=False,
)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str) -> bool:
    return password_hash.verify(password, encoded)


def create_access_token(participant_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": participant_id,
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(participant_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": participant_id,
        "typ": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def participant_from_refresh_token(token: str, database: AsyncDatabase) -> dict:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        participant_id = payload.get("sub")
        if payload.get("typ") != "refresh" or not participant_id or not ObjectId.is_valid(participant_id):
            raise credentials_error
    except InvalidTokenError as error:
        raise credentials_error from error

    participant = await database.participants.find_one({"_id": ObjectId(participant_id)})
    if not participant or not participant.get("is_active", True):
        raise credentials_error
    return participant


async def generate_participant_code(database: AsyncDatabase, prefix: str = "P") -> str:
    """Return the next readable research code, e.g. P001, P002, R001."""
    prefix = prefix.strip().upper() or "P"
    max_number = 0
    cursor = database.participants.find({"participant_code": {"$regex": f"^{prefix}\\d+$"}})
    async for item in cursor:
        code = str(item.get("participant_code", "")).upper()
        number = code.removeprefix(prefix)
        if number.isdigit():
            max_number = max(max_number, int(number))

    while True:
        max_number += 1
        candidate = f"{prefix}{max_number:03d}"
        if not await database.participants.find_one({"participant_code": candidate}):
            return candidate


async def get_current_participant(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    database: AsyncDatabase = Depends(get_database),
) -> dict:
    token = token or request.cookies.get("srp_access_token")
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        participant_id = payload.get("sub")
        if payload.get("typ", "access") != "access" or not participant_id or not ObjectId.is_valid(participant_id):
            raise credentials_error
    except InvalidTokenError as error:
        raise credentials_error from error

    participant = await database.participants.find_one({"_id": ObjectId(participant_id)})
    if not participant or not participant.get("is_active", True):
        raise credentials_error
    return participant


def next_step(participant: dict) -> str:
    if not participant.get("consent_completed", False):
        return "consent"
    if not participant.get("profile_completed", False):
        return "profile"
    return "dashboard"


def public_participant(participant: dict) -> dict:
    return {
        "id": str(participant["_id"]),
        "email": participant["email"],
        "participant_code": participant["participant_code"],
        "name": participant["name"],
        "role": participant.get("role", "participant"),
        "consent_completed": participant.get("consent_completed", False),
        "profile_completed": participant.get("profile_completed", False),
        "next_step": next_step(participant),
    }


async def require_researcher(
    participant: dict = Depends(get_current_participant),
) -> dict:
    allowed_roles = {
        "viewer",
        "researcher",
        "doctor",
        "admin",
        "super_admin",
    }

    if participant.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard access is required",
        )

    approval_status = participant.get("approval_status", "approved")

    if (
        participant.get("role") != "super_admin"
        and approval_status != "approved"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your dashboard access request has not been approved",
        )

    return participant


async def require_super_admin(
    participant: dict = Depends(get_current_participant),
) -> dict:
    if participant.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super administrator access is required",
        )

    return participant


async def bootstrap_researcher(database: AsyncDatabase) -> None:
    """Create or update the configured super-administrator account."""

    if (
        not settings.bootstrap_super_admin_email
        or not settings.bootstrap_super_admin_password
    ):
        return

    email = settings.bootstrap_super_admin_email.lower().strip()
    now = datetime.now(timezone.utc)

    existing = await database.participants.find_one({"email": email})

    account_data = {
        "email": email,
        "name": settings.bootstrap_super_admin_name,
        "password_hash": hash_password(
            settings.bootstrap_super_admin_password
        ),
        "role": "super_admin",
        "is_active": True,
        "email_verified": True,
        "email_verified_at": now,
        "approval_status": "approved",
        "approved_at": now,
        "consent_completed": True,
        "profile_completed": True,
        "updated_at": now,
    }

    if existing:
        if not str(existing.get("participant_code", "")).startswith("A"):
            account_data["participant_code"] = (
                await generate_participant_code(
                    database,
                    prefix="A",
                )
            )

        await database.participants.update_one(
            {"_id": existing["_id"]},
            {"$set": account_data},
        )
        return

    account_data.update(
        {
            "participant_code": await generate_participant_code(
                database,
                prefix="A",
            ),
            "created_at": now,
        }
    )

    await database.participants.insert_one(account_data)
