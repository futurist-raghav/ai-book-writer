"""
FastAPI Dependencies

Common dependencies used across the application.
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import decode_token

# HTTP Bearer token security scheme
security = HTTPBearer()

# Type alias for database session dependency
AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> str:
    """
    Validate JWT token and return the current user's ID.

    Args:
        credentials: HTTP Bearer token from Authorization header.

    Returns:
        The authenticated user's ID.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    token = credentials.credentials
    token_data = decode_token(token)

    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_data.token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data.user_id


# Type alias for current user dependency
CurrentUserIdDep = Annotated[str, Depends(get_current_user_id)]


async def get_current_user(
    db: AsyncSessionDep,
    user_id: CurrentUserIdDep,
):
    """
    Get the current authenticated user from the database.

    Args:
        db: Database session.
        user_id: The authenticated user's ID.

    Returns:
        The User model instance.

    Raises:
        HTTPException: If user not found.
    """
    # Import here to avoid circular imports
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


# Optional authentication (for endpoints that work with or without auth)
async def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[str]:
    """
    Optionally validate JWT token and return user ID.

    Args:
        credentials: Optional HTTP Bearer token.

    Returns:
        User ID if valid token provided, None otherwise.
    """
    if credentials is None:
        return None

    token_data = decode_token(credentials.credentials)
    if token_data is None or token_data.token_type != "access":
        return None

    return token_data.user_id


OptionalUserIdDep = Annotated[Optional[str], Depends(get_optional_user_id)]
