from fastapi import APIRouter
from sqlalchemy import select

from app.dependencies import CurrentUser, CurrentSchool, DB
from app.models.programme import SchoolProgramme, SystemProgramme
from app.models.school_house import SchoolHouse

router = APIRouter()


@router.get("/school/programmes")
async def list_school_programmes(user: CurrentUser, school: CurrentSchool, db: DB):
    """
    Returns the school's programme list.  When the school has no custom
    programmes yet (e.g. freshly registered SHS) we fall back to the seeded
    GES system programmes so that class creation is never blocked.
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

    if progs:
        return [{"id": str(p.id), "name": p.name} for p in progs]

    # No school-specific programmes — serve system defaults as suggestions
    sys_result = await db.execute(
        select(SystemProgramme)
        .where(SystemProgramme.is_active.is_(True))
        .order_by(SystemProgramme.order)
    )
    return [{"id": str(p.id), "name": p.name} for p in sys_result.scalars().all()]


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
