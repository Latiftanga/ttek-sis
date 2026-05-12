import uuid
from sqlalchemy import Column, String, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class GESRank(Base):
    __tablename__ = "ges_ranks"

    id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name     = Column(String(150), unique=True, nullable=False)
    category = Column(String(60), nullable=False)   # teaching | accounting | audit | …
    order    = Column(Integer, default=0)            # sort within category (lower = more junior)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
