from uuid import UUID
from datetime import datetime
from typing import List, Any, Optional
from pydantic import BaseModel


class SyncOperation(BaseModel):
    """One offline operation queued on the device."""
    operation_id: str       # client-generated UUID, for deduplication
    type: str               # "attendance" | "assessment_score"
    action: str             # "create" | "update"
    payload: dict           # the actual data
    created_offline_at: datetime


class SyncBatchRequest(BaseModel):
    """
    Posted by the frontend when connectivity returns.
    Contains all queued operations since last sync.
    """
    operations: List[SyncOperation]


class SyncResult(BaseModel):
    operation_id: str
    success: bool
    error: Optional[str] = None


class SyncBatchResponse(BaseModel):
    processed: int
    succeeded: int
    failed: int
    results: List[SyncResult]
