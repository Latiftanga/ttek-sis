from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.assessment import GradingScale, GradingBand

DEFAULTS = [
    {
        "name": "BECE / WASSCE",
        "description": "Standard WAEC scale for JHS and SHS",
        "bands": [
            (80, 100, "A1", "Excellent",  1),
            (70,  79, "B2", "Very Good",  2),
            (60,  69, "B3", "Good",       3),
            (55,  59, "C4", "Credit",     4),
            (50,  54, "C5", "Credit",     5),
            (45,  49, "C6", "Credit",     6),
            (40,  44, "D7", "Pass",       7),
            (35,  39, "E8", "Pass",       8),
            ( 0,  34, "F9", "Fail",       9),
        ],
    },
    {
        "name": "Primary GES",
        "description": "GES standard scale for Primary schools",
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
        "description": "Descriptive scale for early childhood",
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
                GradingScale.school_id == None,
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