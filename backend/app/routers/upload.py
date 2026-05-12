import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.dependencies import CurrentUser
from app.config import settings

router = APIRouter()

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
EXT_MAP = {b"\xff\xd8\xff": "jpg", b"\x89PNG": "png", b"RIFF": "webp"}


def _detect_image_ext(data: bytes) -> str | None:
    """Return file extension based on magic bytes, or None if not a supported image."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"\x89PNG":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


@router.post("/photo")
async def upload_photo(
    _: CurrentUser,
    file: UploadFile = File(...),
) -> JSONResponse:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Image must be under 5 MB")

    ext = _detect_image_ext(data)
    if ext is None:
        raise HTTPException(400, "Only JPEG, PNG, and WebP images are allowed")

    filename = f"{uuid.uuid4().hex}.{ext}"
    dest = Path(settings.UPLOADS_DIR) / "photos" / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    return JSONResponse({"url": f"/media/photos/{filename}"})
