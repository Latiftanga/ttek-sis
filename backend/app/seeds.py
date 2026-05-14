from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.models.assessment import GradingScale, GradingBand
from app.models.programme import SystemProgramme
from app.models.academic import Subject
from app.models.ges_rank import GESRank
from app.models.school import School
from app.models.user import User
from app.models.staff import Staff


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

DEFAULT_SUBJECTS = [
    # (name, code, category, level_group)

    # ── Basic school core subjects (Basic 1-9) ────────────────────
    ("English Language",              "ENG",  "core",     "basic"),
    ("Mathematics",                   "MATH", "core",     "basic"),
    ("General Science",               "SCI",  "core",     "basic"),
    ("Social Studies",                "SOC",  "core",     "basic"),
    ("Religious and Moral Education", "RME",  "core",     "basic"),
    ("Career Technology",             "CT",   "core",     "basic"),
    ("Creative Arts and Design",      "CAD",  "core",     "basic"),
    ("Ghanaian Language",             "GHL",  "core",     "basic"),
    ("French",                        "FRE",  "core",     "basic"),
    ("Computing",                     "ICT",  "core",     "basic"),
    ("Physical Education and Health", "PHE",  "core",     "basic"),

    # ── SHS core subjects (all programmes) ───────────────────────
    ("English Language",              "ENG",  "core",     "shs"),
    ("Mathematics",                   "MATH", "core",     "shs"),
    ("General Science",               "SCI",  "core",     "shs"),
    ("Social Studies",                "SOC",  "core",     "shs"),
    ("Physical Education and Health", "PHE",  "core",     "shs"),

    # ── SHS Science electives ─────────────────────────────────────
    ("Biology",                       "BIO",  "elective", "shs"),
    ("Chemistry",                     "CHEM", "elective", "shs"),
    ("Physics",                       "PHY",  "elective", "shs"),
    ("Engineering Science",           "ENGS", "elective", "shs"),

    # ── SHS General Arts electives ────────────────────────────────
    ("Literature-in-English",         "LIT",  "elective", "shs"),
    ("Government",                    "GOV",  "elective", "shs"),
    ("History",                       "HIS",  "elective", "shs"),
    ("Geography",                     "GEO",  "elective", "shs"),
    ("Economics",                     "ECO",  "elective", "shs"),

    # ── SHS Business electives ────────────────────────────────────
    ("Business Management",           "BMT",  "elective", "shs"),
    ("Accounting",                    "ACC",  "elective", "shs"),

    # ── SHS Home Economics electives ─────────────────────────────
    ("Food and Nutrition",            "FND",  "elective", "shs"),
    ("Management in Living",          "MIL",  "elective", "shs"),
    ("Clothing and Textiles",         "CLT",  "elective", "shs"),

    # ── SHS Art / Visual Arts electives ───────────────────────────
    ("Art and Design Studio",         "ADS",  "elective", "shs"),
    ("General Knowledge in Art",      "GKA",  "elective", "shs"),
    ("Performing Arts",               "PFA",  "elective", "shs"),

    # ── SHS Agriculture elective ──────────────────────────────────
    ("Agriculture",                   "AGR",  "elective", "shs"),

    # ── SHS Language electives ────────────────────────────────────
    ("French",                        "FRE",  "elective", "shs"),
    ("Arabic",                        "ARB",  "elective", "shs"),
    ("Latin",                         "LAT",  "elective", "shs"),
    ("Spanish",                       "SPA",  "elective", "shs"),
]


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
# DEMO SCHOOL (development convenience)
# ══════════════════════════════════════════════════════════════════════════

DEMO_SCHOOL_NAME      = "Demo Senior High School"
DEMO_SCHOOL_SLUG      = "demo-shs"
DEMO_ADMIN_EMAIL      = "admin@demo-school.com"
DEMO_ADMIN_PASSWORD   = "changeme123"


async def seed_demo_school(db: AsyncSession) -> None:
    """
    Idempotent — only runs when zero schools exist.
    Creates a demo school + school_admin user so you can log in immediately.
    """
    school_count = await db.execute(select(func.count(School.id)))
    if (school_count.scalar() or 0) > 0:
        return

    pwd = PasswordHash((Argon2Hasher(),))

    school = School(
        name=DEMO_SCHOOL_NAME,
        slug=DEMO_SCHOOL_SLUG,
        school_type="shs",
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
        email=DEMO_ADMIN_EMAIL,
        password_hash=pwd.hash(DEMO_ADMIN_PASSWORD),
        role="school_admin",
        staff_id=staff.id,
    ))
    await db.commit()


async def seed_default_subjects(db: AsyncSession) -> None:
    """
    These are stored as school_id=NULL system defaults.
    When a school is created, relevant subjects are copied
    based on school type.
    We use a SystemSubject concept — school_id NULL means system default.
    """
    for name, code, category, level_group in DEFAULT_SUBJECTS:
        exists = await db.execute(
            select(Subject).where(
                Subject.name == name,
                Subject.level_group == level_group,
                Subject.school_id.is_(None),
            )
        )
        if exists.scalar_one_or_none():
            continue

        db.add(Subject(
            school_id=None,
            name=name,
            code=code,
            category=category,
            level_group=level_group,
        ))

    await db.commit()
