from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.school import School

bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decodes JWT, fetches user from DB.
    Raises 401 if token invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    return user


async def get_current_school(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
) -> School:
    """
    Returns the school of the current user.
    Raises 403 if user has no school (e.g. superadmin).
    """
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No school associated with this account",
        )
    result = await db.execute(
        select(School).where(School.id == current_user.school_id)
    )
    school = result.scalar_one_or_none()
    if not school or not school.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School not found or inactive",
        )
    return school


def require_roles(*roles: str):
    """
    Usage:
      @router.get("/")
      async def my_endpoint(
          user: Annotated[User, Depends(require_roles("school_admin", "headteacher"))]
      ):
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not permitted here",
            )
        return current_user
    return role_checker


# ── Convenience type aliases ───────────────────────────────────────────────
# Use these in router function signatures for cleaner code
#
# Example:
#   async def list_students(
#       user: CurrentUser,
#       school: CurrentSchool,
#       db: DB,
#   ):

CurrentUser   = Annotated[User, Depends(get_current_user)]
CurrentSchool = Annotated[School, Depends(get_current_school)]
DB            = Annotated[AsyncSession, Depends(get_db)]