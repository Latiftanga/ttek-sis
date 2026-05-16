from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from app.dependencies import CurrentUser, CurrentSchool, DB, require_roles
from app.models.programme import SchoolProgramme, SystemProgramme
from app.models.school import School
from app.models.school_house import SchoolHouse
from app.models.user import User
from app.schemas.school import ProgrammeCreate, ProgrammeUpdate, HouseCreate, HouseUpdate, SchoolUpdate

router = APIRouter()

WriteRole = Annotated[User, Depends(require_roles("school_admin", "headteacher"))]
DeleteRole = Annotated[User, Depends(require_roles("school_admin"))]


# ── Programmes ────────────────────────────────────────────────────────────────

@router.get("/school/programmes")
async def list_school_programmes(
    user: CurrentUser,
    school: CurrentSchool,
    db: DB,
    own_only: bool = Query(False),
):
    """
    Returns the school's programme list.
    own_only=true  → only school-specific programmes (for management UI).
    own_only=false → falls back to seeded GES system programmes when none exist
                     (for student/class forms so they're never empty).
    """
    result = await db.execute(
        select(SchoolProgramme)
        .where(
            SchoolProgramme.school_id == school.id,
            SchoolProgramme.is_active.is_(True),
        )
        .order_by(SchoolProgramme.order)
    )
    progs = result.scalars().all()

    if progs or own_only:
        return [{"id": str(p.id), "name": p.name, "short_name": p.short_name, "description": p.description} for p in progs]

    sys_result = await db.execute(
        select(SystemProgramme)
        .where(SystemProgramme.is_active.is_(True))
        .order_by(SystemProgramme.order)
    )
    return [{"id": str(p.id), "name": p.name, "short_name": p.short_name, "description": p.description} for p in sys_result.scalars().all()]


@router.post("/school/programmes", status_code=201)
async def create_programme(body: ProgrammeCreate, _: WriteRole, school: CurrentSchool, db: DB):
    prog = SchoolProgramme(
        school_id=school.id,
        name=body.name,
        short_name=body.short_name,
        description=body.description,
        order=body.order,
    )
    db.add(prog)
    await db.commit()
    await db.refresh(prog)
    return {"id": str(prog.id), "name": prog.name, "description": prog.description}


@router.patch("/school/programmes/{programme_id}")
async def update_programme(
    programme_id: UUID, body: ProgrammeUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(SchoolProgramme).where(
            SchoolProgramme.id == programme_id,
            SchoolProgramme.school_id == school.id,
        )
    )
    prog = result.scalar_one_or_none()
    if not prog:
        raise HTTPException(404, "Programme not found")
    if body.name is not None:
        prog.name = body.name
    if body.short_name is not None:
        prog.short_name = body.short_name
    if body.description is not None:
        prog.description = body.description
    if body.order is not None:
        prog.order = body.order
    await db.commit()
    await db.refresh(prog)
    return {"id": str(prog.id), "name": prog.name, "description": prog.description}


@router.delete("/school/programmes/{programme_id}", status_code=204)
async def delete_programme(
    programme_id: UUID,
    _: DeleteRole, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(SchoolProgramme).where(
            SchoolProgramme.id == programme_id,
            SchoolProgramme.school_id == school.id,
        )
    )
    prog = result.scalar_one_or_none()
    if not prog:
        raise HTTPException(404, "Programme not found")
    await db.delete(prog)
    await db.commit()


# ── Houses ────────────────────────────────────────────────────────────────────

@router.get("/school/houses")
async def list_school_houses(user: CurrentUser, school: CurrentSchool, db: DB):
    result = await db.execute(
        select(SchoolHouse)
        .where(
            SchoolHouse.school_id == school.id,
            SchoolHouse.is_active.is_(True),
        )
        .order_by(SchoolHouse.order)
    )
    houses = result.scalars().all()
    return [{"id": str(h.id), "name": h.name, "color": h.color} for h in houses]


@router.post("/school/houses", status_code=201)
async def create_house(body: HouseCreate, _: WriteRole, school: CurrentSchool, db: DB):
    house = SchoolHouse(
        school_id=school.id,
        name=body.name,
        color=body.color,
        order=body.order,
    )
    db.add(house)
    await db.commit()
    await db.refresh(house)
    return {"id": str(house.id), "name": house.name, "color": house.color}


@router.patch("/school/houses/{house_id}")
async def update_house(
    house_id: UUID, body: HouseUpdate,
    _: WriteRole, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(SchoolHouse).where(
            SchoolHouse.id == house_id,
            SchoolHouse.school_id == school.id,
        )
    )
    house = result.scalar_one_or_none()
    if not house:
        raise HTTPException(404, "House not found")
    if body.name is not None:
        house.name = body.name
    if body.color is not None:
        house.color = body.color
    if body.order is not None:
        house.order = body.order
    await db.commit()
    await db.refresh(house)
    return {"id": str(house.id), "name": house.name, "color": house.color}


@router.delete("/school/houses/{house_id}", status_code=204)
async def delete_house(
    house_id: UUID,
    _: DeleteRole, school: CurrentSchool, db: DB,
):
    result = await db.execute(
        select(SchoolHouse).where(
            SchoolHouse.id == house_id,
            SchoolHouse.school_id == school.id,
        )
    )
    house = result.scalar_one_or_none()
    if not house:
        raise HTTPException(404, "House not found")
    await db.delete(house)
    await db.commit()


# ── School profile ────────────────────────────────────────────────────────────

def _school_dict(s: School) -> dict:
    return {
        "id":           str(s.id),
        "name":         s.name,
        "slug":         s.slug,
        "school_type":  s.school_type,
        "region":       s.region,
        "district":     s.district,
        "address":      s.address,
        "phone":        s.phone,
        "email":        s.email,
        "logo_url":     s.logo_url,
        "accent_color": s.accent_color,
        "subscription": s.subscription,
    }


@router.get("/school/profile")
async def get_school_profile(user: CurrentUser, school: CurrentSchool):
    return _school_dict(school)


@router.patch("/school/profile")
async def update_school_profile(
    body: SchoolUpdate,
    _: WriteRole,
    school: CurrentSchool,
    db: DB,
):
    result = await db.execute(select(School).where(School.id == school.id))
    s = result.scalar_one()
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    await db.commit()
    await db.refresh(s)
    return _school_dict(s)
