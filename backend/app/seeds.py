from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from uuid import UUID

from app.models.assessment import GradingScale, GradingBand
from app.models.programme import SystemProgramme, SchoolProgramme
from app.models.academic import Subject
from app.models.ges_rank import GESRank
from app.models.school import School
from app.models.user import User
from app.models.staff import Staff


# ══════════════════════════════════════════════════════════════════════════
# PER-SCHOOL HELPERS
# ══════════════════════════════════════════════════════════════════════════

async def copy_system_programmes_to_school(
    db: AsyncSession, school_id: UUID
) -> None:
    """
    Seed a new SHS school with the GES standard programmes so admins see
    them in the Programmes tab and can customise. Idempotent — skips
    programmes the school already has.
    """
    existing_res = await db.execute(
        select(SchoolProgramme.name).where(SchoolProgramme.school_id == school_id)
    )
    existing_names = {row[0] for row in existing_res.all()}

    sys_progs = await db.execute(
        select(SystemProgramme)
        .where(SystemProgramme.is_active.is_(True))
        .order_by(SystemProgramme.order)
    )
    for p in sys_progs.scalars().all():
        if p.name in existing_names:
            continue
        db.add(SchoolProgramme(
            school_id=school_id,
            name=p.name,
            short_name=p.short_name,
            description=p.description,
            order=p.order,
            is_active=True,
        ))


# ══════════════════════════════════════════════════════════════════════════
# GRADING SCALES
# ══════════════════════════════════════════════════════════════════════════

DEFAULTS = [
    {
        "name": "WASSCE",
        "description": "WAEC standard grading scale for SHS (WASSCE)",
        "bands": [
            # min, max,  label, remark,      order
            (75, 100, "A1", "Excellent",  1),
            (70,  74, "B2", "Very Good",  2),
            (65,  69, "B3", "Good",       3),
            (60,  64, "C4", "Credit",     4),
            (55,  59, "C5", "Credit",     5),
            (50,  54, "C6", "Credit",     6),
            (45,  49, "D7", "Pass",       7),
            (40,  44, "E8", "Pass",       8),
            ( 0,  39, "F9", "Fail",       9),
        ],
    },
    {
        "name": "BECE",
        "description": "WAEC standard grading scale for Basic 7-9 (BECE)",
        "bands": [
            # min, max, label, remark,    order
            (90, 100, "1", "Highest",      1),
            (80,  89, "2", "Higher",       2),
            (70,  79, "3", "High",         3),
            (60,  69, "4", "High Average", 4),
            (55,  59, "5", "Average",      5),
            (50,  54, "6", "Low Average",  6),
            (40,  49, "7", "Low",          7),
            (35,  39, "8", "Lower",        8),
            ( 0,  34, "9", "Lowest",       9),
        ],
    },
    {
        "name": "Primary GES",
        "description": "GES standard scale for Basic 1-6",
        "bands": [
            (80, 100, "1", "Excellent",     1),
            (70,  79, "2", "Very Good",     2),
            (60,  69, "3", "Good",          3),
            (50,  59, "4", "Average",       4),
            ( 0,  49, "5", "Below Average", 5),
        ],
    },
    {
        "name": "KG / Nursery",
        "description": "Descriptive scale for early childhood (Creche, Nursery, KG)",
        "bands": [
            (80, 100, "Excellent",         "Excellent",         1),
            (65,  79, "Very Good",         "Very Good",         2),
            (50,  64, "Good",              "Good",              3),
            ( 0,  49, "Needs Improvement", "Needs Improvement", 4),
        ],
    },
]


async def seed_grading_scales(db: AsyncSession) -> None:
    """Idempotent — skips already seeded scales."""
    for s in DEFAULTS:
        exists = await db.execute(
            select(GradingScale).where(
                GradingScale.name == s["name"],
                GradingScale.school_id.is_(None),
            )
        )
        if exists.scalar_one_or_none():
            continue

        scale = GradingScale(
            school_id=None,
            name=s["name"],
            description=s["description"],
        )
        db.add(scale)
        await db.flush()

        for min_s, max_s, label, remark, order in s["bands"]:
            db.add(GradingBand(
                scale_id=scale.id,
                min_score=min_s,
                max_score=max_s,
                grade_label=label,
                remark=remark,
                order=order,
            ))

    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# SHS PROGRAMMES
# ══════════════════════════════════════════════════════════════════════════

GES_PROGRAMMES = [
    # (name, short_name, description, order)
    ("Agriculture",        "AGR", "Crop Science, Animal Science, Agribusiness, Farm Management",          1),
    ("General Arts",       "GAR", "Literature-in-English, Government, History, Economics, Geography",    2),
    ("Science",            "SCI", "Biology, Chemistry, Physics, Engineering Science, Elective Maths",    3),
    ("Business",           "BUS", "Business Management, Accounting, Economics, Elective Mathematics",    4),
    ("STEM",               "STM", "Integrated Science, Technology, Engineering, and Mathematics",        5),
    ("Applied Technology", "ATE", "Technical and Vocational Education and Training (TVET)",              6),
    ("Home Economics",     "HEC", "Food and Nutrition, Management in Living, Clothing and Textiles",     7),
    ("Art",                "ART", "Art and Design Studio, General Knowledge in Art, Performing Arts",    8),
    ("Language",           "LNG", "Modern languages — French, Arabic, Latin, Spanish",                   9),
]


async def seed_system_programmes(db: AsyncSession) -> None:
    for name, short_name, description, order in GES_PROGRAMMES:
        result = await db.execute(
            select(SystemProgramme).where(SystemProgramme.name == name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            if existing.short_name != short_name:
                existing.short_name = short_name
            continue
        db.add(SystemProgramme(
            name=name,
            short_name=short_name,
            description=description,
            order=order,
        ))
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# DEFAULT SUBJECTS
# ══════════════════════════════════════════════════════════════════════════

# Subjects copied to each school on creation. Schools are single-level
# (basic OR shs), so two separate lists.

BASIC_SUBJECTS = [
    # (name, code)
    ("English Language",              "ENG"),
    ("Mathematics",                   "MATH"),
    ("General Science",               "SCI"),
    ("Social Studies",                "SOC"),
    ("Religious and Moral Education", "RME"),
    ("Career Technology",             "CT"),
    ("Creative Arts and Design",      "CAD"),
    ("Ghanaian Language",             "GHL"),
    ("French",                        "FRE"),
    ("Computing",                     "ICT"),
    ("Physical Education and Health", "PHE"),
]

SHS_SUBJECTS = [
    # (name, code, category)
    # Core (all SHS students take these)
    ("English Language",              "ENG",  "core"),
    ("Mathematics",                   "MATH", "core"),
    ("General Science",               "SCI",  "core"),
    ("Social Studies",                "SOC",  "core"),
    ("Physical Education and Health", "PHE",  "core"),
    # Electives — vary by programme
    ("Biology",                       "BIO",  "elective"),
    ("Chemistry",                     "CHEM", "elective"),
    ("Physics",                       "PHY",  "elective"),
    ("Engineering Science",           "ENGS", "elective"),
    ("Literature-in-English",         "LIT",  "elective"),
    ("Government",                    "GOV",  "elective"),
    ("History",                       "HIS",  "elective"),
    ("Geography",                     "GEO",  "elective"),
    ("Economics",                     "ECO",  "elective"),
    ("Business Management",           "BMT",  "elective"),
    ("Accounting",                    "ACC",  "elective"),
    ("Food and Nutrition",            "FND",  "elective"),
    ("Management in Living",          "MIL",  "elective"),
    ("Clothing and Textiles",         "CLT",  "elective"),
    ("Art and Design Studio",         "ADS",  "elective"),
    ("General Knowledge in Art",      "GKA",  "elective"),
    ("Performing Arts",               "PFA",  "elective"),
    ("Agriculture",                   "AGR",  "elective"),
    ("French",                        "FRE",  "elective"),
    ("Arabic",                        "ARB",  "elective"),
    ("Latin",                         "LAT",  "elective"),
    ("Spanish",                       "SPA",  "elective"),
]


async def copy_default_subjects_to_school(
    db: AsyncSession, school_id: UUID, school_type: str
) -> None:
    """Seed a new school with its default subject catalogue. Idempotent."""
    existing = await db.execute(
        select(Subject.name).where(Subject.school_id == school_id)
    )
    existing_names = {row[0] for row in existing.all()}

    if school_type == "shs":
        for name, code, category in SHS_SUBJECTS:
            if name in existing_names:
                continue
            db.add(Subject(school_id=school_id, name=name, code=code, category=category))
    else:
        for name, code in BASIC_SUBJECTS:
            if name in existing_names:
                continue
            db.add(Subject(school_id=school_id, name=name, code=code, category=None))


# ══════════════════════════════════════════════════════════════════════════
# GES RANKS
# ══════════════════════════════════════════════════════════════════════════

# Each entry: (category, order, name)
GES_RANKS: list[tuple[str, int, str]] = [
    # ── Teaching Staff (GES, lowest → highest) ───────────────────────────
    ("teaching",  1,  "Pupil Teacher"),
    ("teaching",  2,  "Superintendent II"),
    ("teaching",  3,  "Superintendent I"),
    ("teaching",  4,  "Senior Superintendent II"),
    ("teaching",  5,  "Senior Superintendent I"),
    ("teaching",  6,  "Principal Superintendent"),
    ("teaching",  7,  "Assistant Director II"),
    ("teaching",  8,  "Assistant Director I"),
    ("teaching",  9,  "Deputy Director"),
    ("teaching", 10,  "Director II"),
    ("teaching", 11,  "Director I"),
    ("teaching", 12,  "Deputy Director-General"),
    ("teaching", 13,  "Director-General"),

    # ── Accounting ────────────────────────────────────────────────────────
    ("accounting", 1, "Principal Accountant"),
    ("accounting", 2, "Deputy Chief Accountant I"),
    ("accounting", 3, "Chief Accountant II"),
    ("accounting", 4, "Chief Accountant I"),

    # ── Internal Audit ────────────────────────────────────────────────────
    ("audit", 1, "Principal Internal Auditor"),
    ("audit", 2, "Deputy Chief Internal Auditor II"),
    ("audit", 3, "Deputy Chief Internal Auditor I"),
    ("audit", 4, "Chief Internal Auditor II"),

    # ── Administration ────────────────────────────────────────────────────
    ("administration", 1, "Principal Administration Officer"),
    ("administration", 2, "Deputy Chief Administrative Officer II"),
    ("administration", 3, "Deputy Chief Administrative Officer I"),
    ("administration", 4, "Chief Administrative Officer II"),

    # ── Catering ──────────────────────────────────────────────────────────
    ("catering", 1, "Principal Domestic Bursar"),
    ("catering", 2, "Deputy Chief Domestic Bursar"),
    ("catering", 3, "Chief Domestic Bursar"),

    # ── Technical ─────────────────────────────────────────────────────────
    ("technical", 1, "Principal Technical Officer"),
    ("technical", 2, "Deputy Chief Technical Officer"),
    ("technical", 3, "Chief Technical Officer"),

    # ── Supply ────────────────────────────────────────────────────────────
    ("supply", 1, "Principal Supply Officer"),
    ("supply", 2, "Deputy Chief Supply Officer"),
    ("supply", 3, "Chief Supply Officer"),

    # ── Laboratory ────────────────────────────────────────────────────────
    ("laboratory", 1, "Principal Laboratory Technician"),
    ("laboratory", 2, "Deputy Chief Laboratory Technician"),
    ("laboratory", 3, "Chief Laboratory Technician"),

    # ── Secretarial ───────────────────────────────────────────────────────
    ("secretarial", 1, "Private Secretary"),
    ("secretarial", 2, "Senior Private Secretary"),
    ("secretarial", 3, "Principal Private Secretary"),

    # ── Driver ────────────────────────────────────────────────────────────
    ("driver", 1, "Yard Foreman"),
    ("driver", 2, "Chief Driver"),
    ("driver", 3, "Principal Driver"),
]


async def seed_ges_ranks(db: AsyncSession) -> None:
    """Idempotent — inserts new ranks and corrects category/order for existing ones."""
    for category, order, name in GES_RANKS:
        result = await db.execute(select(GESRank).where(GESRank.name == name))
        existing = result.scalar_one_or_none()
        if existing:
            if existing.order != order or existing.category != category:
                existing.order = order
                existing.category = category
        else:
            db.add(GESRank(name=name, category=category, order=order))
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════
# DEMO SCHOOLS (showcase convenience — enabled via SEED_DEMO=true)
# ══════════════════════════════════════════════════════════════════════════

DEMO_SCHOOLS = [
    {
        "name":     "Demo Senior High School",
        "slug":     "demo-shs",
        "type":     "shs",
        "email":    "admin@demo-shs.com",
        "password": "demo-shs-2024",
    },
    {
        "name":     "Demo Basic School",
        "slug":     "demo-basic",
        "type":     "basic",
        "email":    "admin@demo-basic.com",
        "password": "demo-basic-2024",
    },
]


async def _create_demo_school(db: AsyncSession, cfg: dict, pwd: PasswordHash) -> None:
    """Create one demo school + admin user if the slug doesn't exist yet."""
    existing = await db.execute(select(School).where(School.slug == cfg["slug"]))
    if existing.scalar_one_or_none():
        return

    school = School(
        name=cfg["name"],
        slug=cfg["slug"],
        school_type=cfg["type"],
        region="Greater Accra",
        district="Accra Metro",
        subscription="trial",
    )
    db.add(school)
    await db.flush()

    staff = Staff(
        school_id=school.id,
        first_name="Demo",
        last_name="Admin",
        status="active",
    )
    db.add(staff)
    await db.flush()

    db.add(User(
        school_id=school.id,
        email=cfg["email"],
        password_hash=pwd.hash(cfg["password"]),
        role="school_admin",
        staff_id=staff.id,
    ))

    if cfg["type"] == "shs":
        await copy_system_programmes_to_school(db, school.id)

    await copy_default_subjects_to_school(db, school.id, cfg["type"])


async def seed_demo_schools(db: AsyncSession) -> None:
    """Idempotent — creates demo SHS + Basic schools (keyed by slug)."""
    pwd = PasswordHash((Argon2Hasher(),))
    for cfg in DEMO_SCHOOLS:
        await _create_demo_school(db, cfg, pwd)
    await db.commit()


