import secrets
import string
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.dependencies import CurrentUser, CurrentSchool, DB, require_roles
from app.models.staff import Staff, StaffQualification, StaffPromotion
from app.models.user import User
from app.models.ges_rank import GESRank
from app.schemas.staff import (
    StaffCreate, StaffUpdate, StaffSummary, StaffResponse,
    InviteStaff, InviteResponse,
    QualificationCreate, QualificationResponse,
    PromotionCreate, PromotionResponse,
    GESRankItem,
)

router = APIRouter()
_pwd = PasswordHash((Argon2Hasher(),))


def _hash(pw: str) -> str:
    return _pwd.hash(pw)


def _gen_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _can_manage(current_user: User, staff_id: UUID) -> bool:
    """True when the user is managing their own record or has elevated role."""
    if current_user.role in ("school_admin", "headteacher"):
        return True
    return current_user.staff_id == staff_id


def _load_full(q):
    return q.options(
        selectinload(Staff.user),
        selectinload(Staff.qualifications),
        selectinload(Staff.promotions),
    )


# ── GES rank catalogue ────────────────────────────────────────────────────
@router.get("/ges-ranks", response_model=list[GESRankItem])
async def list_ges_ranks(db: DB, _: CurrentUser):
    result = await db.execute(
        select(GESRank).order_by(GESRank.category, GESRank.order)
    )
    return result.scalars().all()


# ── List staff ────────────────────────────────────────────────────────────
@router.get("/", response_model=list[StaffSummary])
async def list_staff(
    db: DB,
    current_user: CurrentUser,
    school: CurrentSchool,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    role:   Optional[str] = Query(None),
    skip:   int = Query(0,  ge=0),
    limit:  int = Query(50, ge=1, le=500),
):
    q = (
        select(Staff)
        .where(Staff.school_id == school.id)
        .options(
            selectinload(Staff.user),
            selectinload(Staff.promotions),   # needed for current_rank property
        )
    )
    if search:
        term = f"%{search.lower()}%"
        q = q.where(or_(
            func.lower(Staff.first_name).like(term),
            func.lower(Staff.last_name).like(term),
            func.lower(Staff.staff_number).like(term),
            func.lower(Staff.specialization).like(term),
            func.lower(Staff.phone).like(term),
        ))
    if status:
        q = q.where(Staff.status == status)
    if role:
        q = q.join(User, User.staff_id == Staff.id).where(User.role == role)

    q = q.order_by(Staff.last_name, Staff.first_name).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ── Get one ───────────────────────────────────────────────────────────────
@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff(
    staff_id: UUID,
    db: DB,
    current_user: CurrentUser,
    school: CurrentSchool,
):
    result = await db.execute(
        _load_full(
            select(Staff).where(Staff.id == staff_id, Staff.school_id == school.id)
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


# ── Create ────────────────────────────────────────────────────────────────
@router.post("/", response_model=StaffResponse, status_code=201)
async def create_staff(
    body: StaffCreate,
    db: DB,
    _: Annotated[User, Depends(require_roles("school_admin", "headteacher"))],
    school: CurrentSchool,
):
    if body.email:
        exists = await db.execute(select(User).where(User.email == body.email.lower()))
        if exists.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")

    staff = Staff(
        school_id=school.id,
        staff_number=body.staff_number,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        gender=body.gender,
        date_of_birth=body.date_of_birth,
        phone=body.phone,
        photo_url=body.photo_url,
        title=body.title,
        license_number=body.license_number,
        specialization=body.specialization,
        date_joined=body.date_joined,
        status=body.status,
    )
    db.add(staff)
    await db.flush()

    if body.email:
        raw_password = body.password or _gen_password()
        user = User(
            school_id=school.id,
            email=body.email.lower(),
            password_hash=_hash(raw_password),
            role=body.role,
            staff_id=staff.id,
        )
        db.add(user)

    await db.commit()
    result = await db.execute(_load_full(select(Staff).where(Staff.id == staff.id)))
    return result.scalar_one()


# ── Update ────────────────────────────────────────────────────────────────
@router.patch("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: UUID,
    body: StaffUpdate,
    db: DB,
    current_user: Annotated[User, Depends(require_roles("school_admin", "headteacher"))],
    school: CurrentSchool,
):
    result = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.school_id == school.id)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(staff, field, value)

    await db.commit()
    result = await db.execute(_load_full(select(Staff).where(Staff.id == staff_id)))
    return result.scalar_one()


# ── Deactivate (soft delete) ──────────────────────────────────────────────
@router.delete("/{staff_id}", status_code=204)
async def deactivate_staff(
    staff_id: UUID,
    db: DB,
    _: Annotated[User, Depends(require_roles("school_admin"))],
    school: CurrentSchool,
):
    result = await db.execute(
        select(Staff)
        .where(Staff.id == staff_id, Staff.school_id == school.id)
        .options(selectinload(Staff.user))
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    staff.status = "retired"
    if staff.user:
        staff.user.is_active = False
    await db.commit()


# ── Invite / reset credentials ────────────────────────────────────────────
@router.post("/{staff_id}/invite", response_model=InviteResponse)
async def invite_staff(
    staff_id: UUID,
    body: InviteStaff,
    db: DB,
    _: Annotated[User, Depends(require_roles("school_admin", "headteacher"))],
    school: CurrentSchool,
):
    result = await db.execute(
        select(Staff)
        .where(Staff.id == staff_id, Staff.school_id == school.id)
        .options(selectinload(Staff.user))
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    raw_password = body.password or _gen_password()

    if staff.user:
        staff.user.email = body.email.lower()
        staff.user.role = body.role
        staff.user.password_hash = _hash(raw_password)
        staff.user.is_active = True
    else:
        exists = await db.execute(select(User).where(User.email == body.email.lower()))
        if exists.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
        db.add(User(
            school_id=school.id,
            email=body.email.lower(),
            password_hash=_hash(raw_password),
            role=body.role,
            staff_id=staff.id,
        ))

    await db.commit()
    result = await db.execute(_load_full(select(Staff).where(Staff.id == staff_id)))
    refreshed = result.scalar_one()

    data = StaffResponse.model_validate(refreshed).model_dump()
    data["temp_password"] = raw_password
    return data


# ── Toggle login ──────────────────────────────────────────────────────────
@router.post("/{staff_id}/toggle-account", response_model=StaffResponse)
async def toggle_account(
    staff_id: UUID,
    db: DB,
    _: Annotated[User, Depends(require_roles("school_admin", "headteacher"))],
    school: CurrentSchool,
):
    result = await db.execute(
        select(Staff)
        .where(Staff.id == staff_id, Staff.school_id == school.id)
        .options(selectinload(Staff.user))
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if not staff.user:
        raise HTTPException(status_code=400, detail="No login account linked")
    staff.user.is_active = not staff.user.is_active
    await db.commit()
    result = await db.execute(_load_full(select(Staff).where(Staff.id == staff_id)))
    return result.scalar_one()


# ── Qualifications ────────────────────────────────────────────────────────
@router.post("/{staff_id}/qualifications", response_model=QualificationResponse, status_code=201)
async def add_qualification(
    staff_id: UUID,
    body: QualificationCreate,
    db: DB,
    current_user: CurrentUser,
    school: CurrentSchool,
):
    if not _can_manage(current_user, staff_id):
        raise HTTPException(status_code=403, detail="Not authorised")

    staff = await db.get(Staff, staff_id)
    if not staff or staff.school_id != school.id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    qual = StaffQualification(staff_id=staff_id, **body.model_dump())
    db.add(qual)
    await db.commit()
    await db.refresh(qual)
    return qual


@router.delete("/{staff_id}/qualifications/{qual_id}", status_code=204)
async def remove_qualification(
    staff_id: UUID,
    qual_id: UUID,
    db: DB,
    current_user: CurrentUser,
    school: CurrentSchool,
):
    if not _can_manage(current_user, staff_id):
        raise HTTPException(status_code=403, detail="Not authorised")

    staff = await db.get(Staff, staff_id)
    if not staff or staff.school_id != school.id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    result = await db.execute(
        select(StaffQualification).where(
            StaffQualification.id == qual_id,
            StaffQualification.staff_id == staff_id,
        )
    )
    qual = result.scalar_one_or_none()
    if not qual:
        raise HTTPException(status_code=404, detail="Qualification not found")
    await db.delete(qual)
    await db.commit()


# ── Promotions ────────────────────────────────────────────────────────────
@router.post("/{staff_id}/promotions", response_model=PromotionResponse, status_code=201)
async def add_promotion(
    staff_id: UUID,
    body: PromotionCreate,
    db: DB,
    current_user: CurrentUser,
    school: CurrentSchool,
):
    if not _can_manage(current_user, staff_id):
        raise HTTPException(status_code=403, detail="Not authorised")

    staff = await db.get(Staff, staff_id)
    if not staff or staff.school_id != school.id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    promo = StaffPromotion(staff_id=staff_id, **body.model_dump())
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return promo


@router.delete("/{staff_id}/promotions/{promo_id}", status_code=204)
async def remove_promotion(
    staff_id: UUID,
    promo_id: UUID,
    db: DB,
    _: Annotated[User, Depends(require_roles("school_admin", "headteacher"))],
    school: CurrentSchool,
):
    staff = await db.get(Staff, staff_id)
    if not staff or staff.school_id != school.id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    result = await db.execute(
        select(StaffPromotion).where(
            StaffPromotion.id == promo_id,
            StaffPromotion.staff_id == staff_id,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion record not found")
    await db.delete(promo)
    await db.commit()
