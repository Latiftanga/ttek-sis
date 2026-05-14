from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.routers import auth, students, classes, staff as staff_router
from app.routers import attendance as attendance_router
from app.routers import grades as grades_router
from app.routers import upload as upload_router
from app.routers import schools as schools_router
from app.dependencies import CurrentUser

from app.models import *  # noqa
from app.seeds import (
    seed_grading_scales,
    seed_system_programmes,
    seed_ges_ranks,
    seed_demo_schools,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOADS_DIR).joinpath("photos").mkdir(parents=True, exist_ok=True)
    async with AsyncSessionLocal() as db:
        await seed_grading_scales(db)
        await seed_system_programmes(db)
        await seed_ges_ranks(db)
        if settings.SEED_DEMO:
            await seed_demo_schools(db)
        yield


app = FastAPI(
    title="TTEK-SIS API",
    description="Tagnatek Student Information System",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/me", tags=["Auth"])
async def me(user: CurrentUser):
    return {"id": str(user.id), "role": user.role, "email": user.email}


app.include_router(upload_router.router, prefix="/api/upload", tags=["Upload"])
app.include_router(schools_router.router, prefix="/api", tags=["School"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(classes.router, prefix="/api", tags=["Academic"])
app.include_router(attendance_router.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(grades_router.router, prefix="/api/assessments", tags=["Assessments"])
app.include_router(staff_router.router, prefix="/api/staff", tags=["Staff"])

app.mount("/media", StaticFiles(directory=settings.UPLOADS_DIR), name="media")
