import re
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.school import School
from app.models.staff import Staff
from app.redis_client import check_rate_limit
from app.seeds import copy_system_programmes_to_school, copy_default_subjects_to_school

from app.schemas.user import (
    LoginRequest, TokenResponse, SchoolBrief, UserResponse,
    RegisterRequest,
)

router = APIRouter()
pwd = PasswordHash((Argon2Hasher(),))
UTC = timezone.utc

_DUMMY_HASH = pwd.hash("__dummy_password__")

_REFRESH_COOKIE = "refresh_token"
_COOKIE_PATH = "/api/auth"


def hash_password(password: str) -> str:
    return pwd.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd.verify(plain, hashed)

def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.now(UTC) + expires_delta}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50]
    return f"{slug}-{str(uuid.uuid4())[:4]}"

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV != "development",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400,
        path=_COOKIE_PATH,
    )

def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path=_COOKIE_PATH)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(f"login:{client_ip}", limit=10, window_seconds=300)

    result = await db.execute(
        select(User).where(User.email == body.email.lower())
    )
    user = result.scalar_one_or_none()

    # Always run verify_password to prevent timing-based email enumeration.
    password_ok = verify_password(
        body.password,
        user.password_hash if user else _DUMMY_HASH,
    )
    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    school = None
    if user.school_id:
        res = await db.execute(
            select(School).where(School.id == user.school_id)
        )
        school = res.scalar_one_or_none()

    token_data = {
        "sub":       str(user.id),
        "school_id": str(user.school_id) if user.school_id else None,
        "role":      user.role,
    }
    access_token = create_token(
        token_data,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_token(
        {**token_data, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )

    _set_refresh_cookie(response, refresh_token)

    user.last_login = datetime.now(UTC)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
        school=SchoolBrief.model_validate(school) if school else None,
    )


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except (JWTError, ValueError):
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Account inactive")

    token_data = {
        "sub":       str(user.id),
        "school_id": str(user.school_id) if user.school_id else None,
        "role":      user.role,
    }
    access_token = create_token(
        token_data,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # Rotate the refresh token
    new_refresh = create_token(
        {**token_data, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    _set_refresh_cookie(response, new_refresh)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=204)
async def logout(response: Response):
    _clear_refresh_cookie(response)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_school(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    exists = await db.execute(
        select(User).where(User.email == body.admin_email.lower())
    )
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    school = School(
        name=body.name,
        slug=make_slug(body.name),
        school_type=body.school_type,
        region=body.region,
        district=body.district,
        phone=body.phone,
        email=body.email,
        subscription="trial",
    )
    db.add(school)
    await db.flush()

    staff = Staff(
        school_id=school.id,
        first_name=body.admin_first_name,
        last_name=body.admin_last_name,
        phone=body.admin_phone,
        status="active",
    )
    db.add(staff)
    await db.flush()

    user = User(
        school_id=school.id,
        email=body.admin_email.lower(),
        password_hash=hash_password(body.admin_password),
        role="school_admin",
        staff_id=staff.id,
    )
    db.add(user)

    if school.school_type == "shs":
        await copy_system_programmes_to_school(db, school.id)

    await copy_default_subjects_to_school(db, school.id, school.school_type)

    await db.commit()

    return {
        "message": "School registered successfully",
        "slug": school.slug,
    }
