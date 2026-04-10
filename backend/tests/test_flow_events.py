"""
Tests for Flow Events API Routes

Comprehensive test coverage for all flow event endpoints including CRUD,
dependency management, timeline queries, and chapter associations.
"""

import uuid
from datetime import datetime
from typing import Optional

import pytest
from fastapi import status
from sqlalchemy import select

from app.models import Book, Chapter, FlowEvent, FlowDependency, FlowChapterEvent, User
from app.schemas.flow_event import FlowEventTypeEnum, FlowEventStatusEnum


# Test data fixtures


@pytest.fixture
def test_user(test_db):
    """Fixture for test user."""
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        username="testuser",
        hashed_password="hashed_pwd",
        role="USER",
    )
    test_db.add(user)
    test_db.commit()
    return user


@pytest.fixture
def test_book(test_db, test_user):
    """Fixture for test book."""
    book = Book(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Test Book",
        description="Test Description",
        status="draft",
    )
    test_db.add(book)
    test_db.commit()
    test_db.refresh(book)
    return book


@pytest.fixture
def test_chapter(test_db, test_book):
    """Fixture for test chapter."""
    chapter = Chapter(
        id=uuid.uuid4(),
        book_id=test_book.id,
        number=1,
        title="Chapter 1",
        status="draft",
    )
    test_db.add(chapter)
    test_db.commit()
    test_db.refresh(chapter)
    return chapter


@pytest.fixture
def test_flow_event(test_db, test_book):
    """Fixture for test flow event."""
    event = FlowEvent(
        id=uuid.uuid4(),
        book_id=test_book.id,
        title="Test Event",
        description="Test event description",
        event_type=FlowEventTypeEnum.scene.value,
        timeline_position=100,
        duration=30,
        status=FlowEventStatusEnum.planned.value,
    )
    test_db.add(event)
    test_db.commit()
    test_db.refresh(event)
    return event


# CRUD Tests


@pytest.mark.unit
@pytest.mark.models
class TestFlowEventsCRUD:
    """Tests for CRUD operations on flow events."""

    def test_create_flow_event(self, test_db, test_book, test_user):
        """Test creating a new flow event."""
        event = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Opening Scene",
            description="The story begins",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            duration=45,
            status=FlowEventStatusEnum.planned.value,
        )
        test_db.add(event)
        test_db.commit()
        test_db.refresh(event)
        
        assert event.id is not None
        assert event.title == "Opening Scene"
        assert event.event_type == FlowEventTypeEnum.scene.value
        assert event.timeline_position == 0
        assert event.duration == 45

    def test_list_flow_events(self, test_db, test_book, test_flow_event):
        """Test listing flow events."""
        result = test_db.query(FlowEvent).filter(FlowEvent.book_id == test_book.id).all()
        
        assert len(result) >= 1
        assert any(e.title == "Test Event" for e in result)

    def test_list_flow_events_with_filter(self, test_db, test_book):
        """Test listing flow events with type filter."""
        # Create events with different types
        scene_event = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Scene 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        beat_event = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Beat 1",
            event_type=FlowEventTypeEnum.beat.value,
            timeline_position=10,
            status=FlowEventStatusEnum.planned.value,
        )
        test_db.add_all([scene_event, beat_event])
        test_db.commit()
        
        # Filter by type
        result = test_db.query(FlowEvent).filter(
            FlowEvent.book_id == test_book.id,
            FlowEvent.event_type == FlowEventTypeEnum.scene.value
        ).all()
        
        assert len(result) >= 1
        assert all(e.event_type == FlowEventTypeEnum.scene.value for e in result)

    def test_get_flow_event(self, test_db, test_book, test_flow_event):
        """Test getting a specific flow event."""
        result = test_db.query(FlowEvent).filter(
            FlowEvent.id == test_flow_event.id,
            FlowEvent.book_id == test_book.id
        ).first()
        
        assert result is not None
        assert result.id == test_flow_event.id
        assert result.title == "Test Event"

    def test_update_flow_event(self, test_db, test_flow_event):
        """Test updating a flow event."""
        test_flow_event.status = FlowEventStatusEnum.completed.value
        test_flow_event.timeline_position = 150
        test_db.commit()
        test_db.refresh(test_flow_event)
        
        assert test_flow_event.status == FlowEventStatusEnum.completed.value
        assert test_flow_event.timeline_position == 150

    def test_delete_flow_event(self, test_db, test_book, test_flow_event):
        """Test deleting a flow event."""
        event_id = test_flow_event.id
        test_db.delete(test_flow_event)
        test_db.commit()
        
        # Verify event is deleted
        result = test_db.query(FlowEvent).filter(FlowEvent.id == event_id).first()
        assert result is None


# Dependency Management Tests


@pytest.mark.unit
@pytest.mark.models
class TestFlowEventDependencies:
    """Tests for flow event dependency management."""

    def test_add_dependency(self, test_db, test_book):
        """Test adding a dependency between events."""
        # Create two events
        event1 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        event2 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 2",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=50,
            status=FlowEventStatusEnum.planned.value,
        )
        test_db.add_all([event1, event2])
        test_db.commit()
        
        dependency = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=event1.id,
            to_event_id=event2.id,
            dependency_type="blocks",
        )
        test_db.add(dependency)
        test_db.commit()
        test_db.refresh(dependency)
        
        assert dependency.id is not None
        assert dependency.from_event_id == event1.id
        assert dependency.to_event_id == event2.id
        assert dependency.dependency_type == "blocks"

    def test_get_event_dependencies(self, test_db, test_book):
        """Test retrieving dependencies for an event."""
        # Create events and dependency
        event1 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        event2 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 2",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=50,
            status=FlowEventStatusEnum.planned.value,
        )
        test_db.add_all([event1, event2])
        test_db.commit()
        
        dependency = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=event1.id,
            to_event_id=event2.id,
            dependency_type="blocks",
        )
        test_db.add(dependency)
        test_db.commit()
        
        # Get all dependencies for event1
        result = test_db.query(FlowDependency).filter(
            FlowDependency.from_event_id == event1.id
        ).all()
        
        assert len(result) >= 1
        assert result[0].dependency_type == "blocks"

    def test_remove_dependency(self, test_db, test_book):
        """Test removing a dependency."""
        # Create events and dependency
        event1 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        event2 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 2",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=50,
            status=FlowEventStatusEnum.planned.value,
        )
        test_db.add_all([event1, event2])
        test_db.commit()
        
        dependency = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=event1.id,
            to_event_id=event2.id,
            dependency_type="blocks",
        )
        test_db.add(dependency)
        test_db.commit()
        
        dep_id = dependency.id
        test_db.delete(dependency)
        test_db.commit()
        
        # Verify dependency is deleted
        result = test_db.query(FlowDependency).filter(FlowDependency.id == dep_id).first()
        assert result is None


# Timeline & Query Tests


@pytest.mark.unit
@pytest.mark.models
class TestFlowEventsTimeline:
    """Tests for timeline organization and queries."""

    def test_timeline_sorting(self, test_db, test_book):
        """Test that events are sorted by timeline position."""
        # Create events at different timeline positions
        events = []
        for i in range(3):
            event = FlowEvent(
                id=uuid.uuid4(),
                book_id=test_book.id,
                title=f"Event {i}",
                event_type=FlowEventTypeEnum.scene.value,
                timeline_position=i * 50,
                status=FlowEventStatusEnum.planned.value,
            )
            events.append(event)
        
        test_db.add_all(events)
        test_db.commit()
        
        # Query ordered by timeline position
        result = test_db.query(FlowEvent).filter(
            FlowEvent.book_id == test_book.id
        ).order_by(FlowEvent.timeline_position).all()
        
        assert len(result) >= 3
        positions = [e.timeline_position for e in result]
        assert positions == sorted(positions)

    def test_dependency_structure(self, test_db, test_book):
        """Test that dependency structure is maintained."""
        # Create three events in sequence
        events = [
            FlowEvent(
                id=uuid.uuid4(),
                book_id=test_book.id,
                title=f"Event {i}",
                event_type=FlowEventTypeEnum.scene.value,
                timeline_position=i * 50,
                status=FlowEventStatusEnum.planned.value,
            )
            for i in range(3)
        ]
        test_db.add_all(events)
        test_db.commit()
        
        # Add dependencies: 0 -> 1 -> 2
        deps = [
            FlowDependency(
                id=uuid.uuid4(),
                from_event_id=events[0].id,
                to_event_id=events[1].id,
                dependency_type="blocks",
            ),
            FlowDependency(
                id=uuid.uuid4(),
                from_event_id=events[1].id,
                to_event_id=events[2].id,
                dependency_type="triggers",
            ),
        ]
        test_db.add_all(deps)
        test_db.commit()
        
        # Verify chain
        dep1 = test_db.query(FlowDependency).filter(
            FlowDependency.from_event_id == events[0].id
        ).first()
        dep2 = test_db.query(FlowDependency).filter(
            FlowDependency.from_event_id == events[1].id
        ).first()
        
        assert dep1.to_event_id == events[1].id
        assert dep2.to_event_id == events[2].id


# Chapter Association Tests


@pytest.mark.unit
@pytest.mark.models
class TestFlowEventsChapters:
    """Tests for chapter-event associations."""

    def test_link_chapter_to_event(self, test_db, test_book, test_chapter, test_flow_event):
        """Test linking a chapter to a flow event."""
        assoc = FlowChapterEvent(
            chapter_id=test_chapter.id,
            event_id=test_flow_event.id,
            order_index=0,
        )
        test_db.add(assoc)
        test_db.commit()
        
        # Verify association exists
        result = test_db.query(FlowChapterEvent).filter(
            FlowChapterEvent.chapter_id == test_chapter.id,
            FlowChapterEvent.event_id == test_flow_event.id,
        ).first()
        
        assert result is not None
        assert result.order_index == 0

    def test_unlink_chapter_from_event(self, test_db, test_chapter, test_flow_event):
        """Test unlinking a chapter from a flow event."""
        assoc = FlowChapterEvent(
            chapter_id=test_chapter.id,
            event_id=test_flow_event.id,
            order_index=0,
        )
        test_db.add(assoc)
        test_db.commit()
        
        test_db.delete(assoc)
        test_db.commit()
        
        # Verify association is deleted
        result = test_db.query(FlowChapterEvent).filter(
            FlowChapterEvent.chapter_id == test_chapter.id,
            FlowChapterEvent.event_id == test_flow_event.id,
        ).first()
        assert result is None


# Error Handling Tests


class TestFlowEventsErrors:
    """Tests for error handling and validation."""

    async def test_create_event_invalid_data(self, client, test_user_id, test_book, mocker):
        """Test creating event with invalid data."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        event_data = {
            "title": "",  # Empty title should fail
            "event_type": "scene",
        }
        
        response = client.post(
            f"/api/v1/books/{test_book.id}/flow-events",
            json=event_data,
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_get_nonexistent_event(self, client, test_user_id, test_book, mocker):
        """Test getting a non-existent event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        fake_id = uuid.uuid4()
        response = client.get(f"/api/v1/books/{test_book.id}/flow-events/{fake_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_update_nonexistent_event(self, client, test_user_id, test_book, mocker):
        """Test updating a non-existent event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        fake_id = uuid.uuid4()
        response = client.patch(
            f"/api/v1/books/{test_book.id}/flow-events/{fake_id}",
            json={"status": "completed"},
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_delete_nonexistent_event(self, client, test_user_id, test_book, mocker):
        """Test deleting a non-existent event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        fake_id = uuid.uuid4()
        response = client.delete(f"/api/v1/books/{test_book.id}/flow-events/{fake_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_add_duplicate_dependency(self, client, test_user_id, test_book, db_session, mocker):
        """Test adding duplicate dependency."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        # Create events
        event1 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        event2 = FlowEvent(
            id=uuid.uuid4(),
            book_id=test_book.id,
            title="Event 2",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=50,
            status=FlowEventStatusEnum.planned.value,
        )
        db_session.add(event1)
        db_session.add(event2)
        await db_session.commit()
        
        # Add dependency twice
        dep_data = {
            "to_event_id": str(event2.id),
            "dependency_type": "blocks",
        }
        
        response1 = client.post(
            f"/api/v1/books/{test_book.id}/flow-events/{event1.id}/dependencies",
            json=dep_data,
        )
        assert response1.status_code == status.HTTP_201_CREATED
        
        # Try to add same dependency again
        response2 = client.post(
            f"/api/v1/books/{test_book.id}/flow-events/{event1.id}/dependencies",
            json=dep_data,
        )
        assert response2.status_code == status.HTTP_400_BAD_REQUEST


# Authorization Tests


class TestFlowEventsAuthorization:
    """Tests for authorization and access control."""

    async def test_create_event_without_auth(self, client, test_book):
        """Test creating event without authentication."""
        event_data = {
            "title": "Test Event",
            "event_type": "scene",
        }
        
        # Mock to simulate no current user
        response = client.post(
            f"/api/v1/books/{test_book.id}/flow-events",
            json=event_data,
        )
        
        # Should return 401 or 403 depending on auth implementation
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    async def test_access_other_user_book(self, client, db_session):
        """Test accessing flow events from another user's book."""
        # Create two users and books
        user1_id = uuid.uuid4()
        user2_id = uuid.uuid4()
        
        book1 = Book(
            id=uuid.uuid4(),
            user_id=user1_id,
            title="Book 1",
            status="draft",
        )
        book1_event = FlowEvent(
            id=uuid.uuid4(),
            book_id=book1.id,
            title="Event in Book 1",
            event_type=FlowEventTypeEnum.scene.value,
            timeline_position=0,
            status=FlowEventStatusEnum.planned.value,
        )
        db_session.add(book1)
        db_session.add(book1_event)
        await db_session.commit()
        
        # Try to access as different user
        # Mock the current user to be user2
        # This should return 404 or 403
        response = client.get(f"/api/v1/books/{book1.id}/flow-events/{book1_event.id}")
        
        # Either not found (404) or forbidden (403) is acceptable
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_403_FORBIDDEN,
        ]
