from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt
from passlib.context import CryptContext

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.school import School
from app.models.staff import Staff
from app.schemas.user import LoginRequest, TokenResponse, SchoolBrief, UserResponse
from app.schemas.school import SchoolCreate

router = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
UTC = timezone.utc


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.now(UTC) + expires_delta}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def make_slug(name: str) -> str:
    import re, uuid
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50]
    return f"{slug}-{str(uuid.uuid4())[:4]}"


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == body.email.lower())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
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

    user.last_login = datetime.now(UTC)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        school=SchoolBrief.model_validate(school) if school else None,
    )


@router.post("/refresh")
async def refresh_token(body: dict):
    token = body.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token required")
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {k: v for k, v in payload.items() if k not in ("exp", "type")}
    access_token = create_token(
        token_data,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


class RegisterRequest(SchoolCreate):
    admin_first_name: str
    admin_last_name: str
    admin_email: str
    admin_password: str
    admin_phone: str | None = None


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
    await db.commit()

    return {
        "message": "School registered successfully",
        "slug": school.slug,
    }
