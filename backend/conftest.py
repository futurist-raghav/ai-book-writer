"""
Shared pytest configuration and fixtures for backend tests
Provides database, authentication, and utility fixtures for all tests
"""

import pytest
import asyncio
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import os
from datetime import datetime, timedelta

# Configure async event loop for pytest
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Database fixtures
@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """
    Create a test database session.
    Uses SQLite in-memory database for fast, isolated tests.
    """
    # Import here to avoid circular imports
    from app.core.database import Base
    
    # Use SQLite in-memory for tests
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = TestingSessionLocal()
    yield db
    db.close()
    engine.dispose()


@pytest.fixture(scope="function")
def test_async_db():
    """Async database session for async tests."""
    # Reserved for future async database tests
    pass


# Authentication fixtures
@pytest.fixture
def test_user():
    """Create a test user object."""
    from app.models.user import User
    return User(
        id="test-user-123",
        email="testuser@example.com",
        username="testuser",
        hashed_password="hashed_password_123",
        role="USER",
        is_active=True,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def test_admin_user():
    """Create a test admin user object."""
    from app.models.user import User
    return User(
        id="test-admin-123",
        email="admin@example.com",
        username="admin",
        hashed_password="hashed_password_123",
        role="ADMIN",
        is_active=True,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def test_token(test_user):
    """Generate a JWT token for testing."""
    from app.core.security import create_access_token
    return create_access_token(
        data={"sub": test_user.id},
        expires_delta=timedelta(hours=1)
    )


@pytest.fixture
def test_admin_token(test_admin_user):
    """Generate a JWT token for admin user."""
    from app.core.security import create_access_token
    return create_access_token(
        data={"sub": test_admin_user.id},
        expires_delta=timedelta(hours=1)
    )


# Book/Project fixtures
@pytest.fixture
def test_book(test_user):
    """Create a test book object."""
    from app.models.book import Book
    return Book(
        id="book-123",
        user_id=test_user.id,
        title="Test Book",
        description="A test book for testing",
        status="draft",
        genre="fiction",
        target_words=50000,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def test_chapter(test_book, test_user):
    """Create a test chapter object."""
    from app.models.chapter import Chapter
    return Chapter(
        id="chapter-123",
        book_id=test_book.id,
        user_id=test_user.id,
        title="Chapter 1: Beginning",
        content="This is the beginning of the story...",
        word_count=1500,
        order=1,
        status="draft",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# Character fixtures
@pytest.fixture
def test_character(test_book, test_user):
    """Create a test character object."""
    from app.models.chapter import Character
    return Character(
        id="char-123",
        book_id=test_book.id,
        user_id=test_user.id,
        name="Alice",
        role="protagonist",
        description="A curious and brave protagonist",
        traits=["intelligent", "brave", "curious"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# Audio/Transcription fixtures
@pytest.fixture
def test_audio_file(test_user, test_book):
    """Create a test audio file object."""
    from app.models.audio import AudioFile
    return AudioFile(
        id="audio-123",
        user_id=test_user.id,
        book_id=test_book.id,
        filename="recording.mp3",
        file_path="/storage/audio/recording.mp3",
        file_size=1024000,
        duration=300,
        mime_type="audio/mpeg",
        created_at=datetime.utcnow(),
        uploaded_at=datetime.utcnow(),
    )


@pytest.fixture
def test_transcription(test_audio_file, test_user):
    """Create a test transcription object."""
    from app.models.transcription import Transcription
    return Transcription(
        id="trans-123",
        audio_id=test_audio_file.id,
        user_id=test_user.id,
        text="This is the transcribed text from the audio file.",
        status="completed",
        language="en",
        confidence=0.95,
        created_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )


# Event fixtures
@pytest.fixture
def test_event(test_book, test_user):
    """Create a test event object."""
    from app.models.event import Event
    return Event(
        id="event-123",
        book_id=test_book.id,
        user_id=test_user.id,
        title="The Meeting",
        description="Characters meet for the first time",
        event_type="narrative",
        start_date=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# Reference/Research fixtures
@pytest.fixture
def test_reference(test_book, test_user):
    """Create a test reference object."""
    from app.models.reference import Reference
    return Reference(
        id="ref-123",
        book_id=test_book.id,
        user_id=test_user.id,
        title="Historical Background",
        url="https://example.com/history",
        notes="Important historical context for the story",
        created_at=datetime.utcnow(),
    )


# Export fixtures
@pytest.fixture
def test_export_config():
    """Create a test export configuration."""
    return {
        "format": "pdf",
        "include_toc": True,
        "include_metadata": True,
        "style": "default",
    }


# API request/response fixtures
@pytest.fixture
def mock_http_client():
    """Mock HTTP client for external API calls."""
    from unittest.mock import AsyncMock, MagicMock
    
    client = AsyncMock()
    client.post = AsyncMock()
    client.get = AsyncMock()
    client.put = AsyncMock()
    client.delete = AsyncMock()
    
    return client


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for caching tests."""
    from unittest.mock import AsyncMock
    
    redis = AsyncMock()
    redis.get = AsyncMock()
    redis.set = AsyncMock()
    redis.delete = AsyncMock()
    redis.incr = AsyncMock()
    
    return redis


# Utility fixtures
@pytest.fixture
def json_data():
    """Sample JSON data for testing."""
    return {
        "title": "Test Title",
        "description": "Test Description",
        "status": "active",
    }


@pytest.fixture
def cleanup_files(tmp_path):
    """Cleanup temporary files after tests."""
    yield tmp_path
    # Cleanup happens automatically with tmp_path


# Markers
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: mark test as a unit test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "slow: mark test as slow")
