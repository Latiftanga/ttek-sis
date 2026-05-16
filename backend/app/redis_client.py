import redis.asyncio as aioredis
from fastapi import HTTPException

from app.config import settings

_pool: aioredis.ConnectionPool | None = None


def _get_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
    return _pool


def get_redis() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=_get_pool())


async def check_rate_limit(key: str, limit: int = 10, window_seconds: int = 300) -> None:
    """Raise HTTP 429 if `key` has exceeded `limit` hits within `window_seconds`."""
    r = get_redis()
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, window_seconds)
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait 5 minutes before trying again.",
        )
