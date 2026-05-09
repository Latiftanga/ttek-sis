from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.assessment import GradingScale, GradingBand
from app.models.programme import SystemProgramme
from app.models.academic import Subject


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
    ("General Science",
     "Physics, Chemistry, Biology, Elective Mathematics", 1),
    ("General Arts",
     "Literature, History, Government, Economics", 2),
    ("Business",
     "Financial Accounting, Business Management, Cost Accounting, Economics", 3),
    ("Home Economics",
     "Food & Nutrition, Clothing & Textiles, Management in Living", 4),
    ("Visual Arts",
     "Graphic Design, Sculpture, Ceramics, Picture Making", 5),
    ("Technical",
     "Technical Drawing, Auto Mechanics, Building Construction", 6),
    ("Agriculture",
     "Crop Science, Animal Science, Agribusiness, Farm Management", 7),
]


async def seed_system_programmes(db: AsyncSession) -> None:
    for name, description, order in GES_PROGRAMMES:
        exists = await db.execute(
            select(SystemProgramme).where(SystemProgramme.name == name)
        )
        if exists.scalar_one_or_none():
            continue
        db.add(SystemProgramme(
            name=name,
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
    ("Integrated Science",            "SCI",  "core",     "basic"),
    ("Social Studies",                "SOC",  "core",     "basic"),
    ("Religious & Moral Education",   "RME",  "core",     "basic"),
    ("Creative Arts & Design",        "CAD",  "core",     "basic"),
    ("Ghanaian Language",             "GHL",  "core",     "basic"),
    ("French",                        "FRE",  "core",     "basic"),
    ("ICT / Computing",               "ICT",  "core",     "basic"),
    ("Physical Education",            "PE",   "core",     "basic"),
    ("Career Technology",             "CT",   "core",     "basic"),
    ("History",                       "HIS",  "core",     "basic"),

    # ── SHS core subjects (all programmes) ───────────────────────
    ("English Language",              "ENG",  "core",     "shs"),
    ("Core Mathematics",              "CMATH","core",     "shs"),
    ("Integrated Science",            "ISCI", "core",     "shs"),
    ("Social Studies",                "SOC",  "core",     "shs"),

    # ── SHS Science electives ─────────────────────────────────────
    ("Elective Mathematics",          "EMATH","elective", "shs"),
    ("Physics",                       "PHY",  "elective", "shs"),
    ("Chemistry",                     "CHEM", "elective", "shs"),
    ("Biology",                       "BIO",  "elective", "shs"),

    # ── SHS Arts electives ────────────────────────────────────────
    ("Literature in English",         "LIT",  "elective", "shs"),
    ("Government",                    "GOV",  "elective", "shs"),
    ("Economics",                     "ECO",  "elective", "shs"),
    ("Geography",                     "GEO",  "elective", "shs"),

    # ── SHS Business electives ────────────────────────────────────
    ("Financial Accounting",          "FACC", "elective", "shs"),
    ("Business Management",           "BUS",  "elective", "shs"),
    ("Cost Accounting",               "CACC", "elective", "shs"),

    # ── SHS Home Economics electives ─────────────────────────────
    ("Food & Nutrition",              "FND",  "elective", "shs"),
    ("Clothing & Textiles",           "CLT",  "elective", "shs"),
    ("Management in Living",          "MIL",  "elective", "shs"),

    # ── SHS Technical electives ───────────────────────────────────
    ("Technical Drawing",             "TD",   "elective", "shs"),
    ("Auto Mechanics",                "AUTO", "elective", "shs"),
    ("Building Construction",         "BC",   "elective", "shs"),

    # ── SHS Visual Arts electives ─────────────────────────────────
    ("Graphic Design",                "GD",   "elective", "shs"),
    ("Ceramics",                      "CER",  "elective", "shs"),
    ("Picture Making",                "PM",   "elective", "shs"),

    # ── SHS Agriculture electives ─────────────────────────────────
    ("Crop Science",                  "CROP", "elective", "shs"),
    ("Animal Science",                "ANIM", "elective", "shs"),
    ("Agribusiness",                  "AGRI", "elective", "shs"),
]


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
