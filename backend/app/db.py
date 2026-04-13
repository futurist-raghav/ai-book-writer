"""
App-level database module for backward compatibility.

This module re-exports database components from app.core.db
to support code that imports from app.db directly.
"""

from app.core.db import (
    Base,
    SessionLocal,
    async_session_maker,
    engine,
    engine_kwargs,
    get_async_session,
    get_db,
    get_session,
    init_db,
    metadata,
)

__all__ = [
    "Base",
    "SessionLocal",
    "async_session_maker",
    "engine",
    "engine_kwargs",
    "get_async_session",
    "get_db",
    "get_session",
    "init_db",
    "metadata",
]
