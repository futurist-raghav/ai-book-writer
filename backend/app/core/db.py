"""
Database aliases for backward compatibility.

This module re-exports database components from database.py
to support existing imports across the codebase.
"""

from app.core.database import (
    Base,
    async_session_maker,
    engine,
    engine_kwargs,
    get_async_session,
    init_db,
    metadata,
)

# Legacy function names some code might expect
def get_db():
    """Legacy alias for get_async_session (deprecated)."""
    return get_async_session()

async def get_session():
    """Legacy alias for get_async_session (deprecated)."""
    async for session in get_async_session():
        yield session

# Compatibility: SessionLocal for code that expects sync sessions
SessionLocal = async_session_maker

__all__ = [
    "Base",
    "async_session_maker",
    "engine",
    "engine_kwargs",
    "get_async_session",
    "get_db",
    "get_session",
    "init_db",
    "metadata",
    "SessionLocal",
]

