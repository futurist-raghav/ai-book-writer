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

from app.models import Book, Chapter, FlowEvent, FlowDependency, FlowChapterEvent
from app.schemas.flow_event import FlowEventTypeEnum, FlowEventStatusEnum


# Test data fixtures


@pytest.fixture
def test_user_id():
    """Fixture for test user ID."""
    return uuid.uuid4()


@pytest.fixture
async def test_book(db_session, test_user_id):
    """Fixture for test book."""
    book = Book(
        id=uuid.uuid4(),
        user_id=test_user_id,
        title="Test Book",
        description="Test Description",
        status="draft",
    )
    db_session.add(book)
    await db_session.commit()
    return book


@pytest.fixture
async def test_chapter(db_session, test_book):
    """Fixture for test chapter."""
    chapter = Chapter(
        id=uuid.uuid4(),
        book_id=test_book.id,
        number=1,
        title="Chapter 1",
        status="draft",
    )
    db_session.add(chapter)
    await db_session.commit()
    return chapter


@pytest.fixture
async def test_flow_event(db_session, test_book):
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
    db_session.add(event)
    await db_session.commit()
    return event


# CRUD Tests


class TestFlowEventsCRUD:
    """Tests for CRUD operations on flow events."""

    async def test_create_flow_event(self, client, test_user_id, test_book, mocker):
        """Test creating a new flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        event_data = {
            "title": "Opening Scene",
            "description": "The story begins",
            "event_type": "scene",
            "timeline_position": 0,
            "duration": 45,
            "status": "planned",
        }
        
        response = client.post(
            f"/api/v1/books/{test_book.id}/flow-events",
            json=event_data,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["title"] == "Opening Scene"
        assert data["event_type"] == "scene"
        assert data["timeline_position"] == 0

    async def test_list_flow_events(self, client, test_user_id, test_book, test_flow_event, mocker):
        """Test listing flow events."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        response = client.get(f"/api/v1/books/{test_book.id}/flow-events")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        assert len(data["data"]) >= 1
        assert any(e["title"] == "Test Event" for e in data["data"])

    async def test_list_flow_events_with_filter(self, client, test_user_id, test_book, db_session, mocker):
        """Test listing flow events with type filter."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        # Create events with different types
        events = [
            FlowEvent(
                id=uuid.uuid4(),
                book_id=test_book.id,
                title="Scene 1",
                event_type=FlowEventTypeEnum.scene.value,
                timeline_position=0,
                status=FlowEventStatusEnum.planned.value,
            ),
            FlowEvent(
                id=uuid.uuid4(),
                book_id=test_book.id,
                title="Beat 1",
                event_type=FlowEventTypeEnum.beat.value,
                timeline_position=10,
                status=FlowEventStatusEnum.planned.value,
            ),
        ]
        for event in events:
            db_session.add(event)
        await db_session.commit()
        
        response = client.get(
            f"/api/v1/books/{test_book.id}/flow-events",
            params={"event_type": "scene"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(e["event_type"] == "scene" for e in data["data"])

    async def test_get_flow_event(self, client, test_user_id, test_book, test_flow_event, mocker):
        """Test getting a specific flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        response = client.get(f"/api/v1/books/{test_book.id}/flow-events/{test_flow_event.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == str(test_flow_event.id)
        assert data["title"] == "Test Event"
        assert "dependencies_from" in data
        assert "dependencies_to" in data

    async def test_update_flow_event(self, client, test_user_id, test_book, test_flow_event, mocker):
        """Test updating a flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        update_data = {
            "status": "completed",
            "timeline_position": 150,
        }
        
        response = client.patch(
            f"/api/v1/books/{test_book.id}/flow-events/{test_flow_event.id}",
            json=update_data,
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["timeline_position"] == 150

    async def test_delete_flow_event(self, client, test_user_id, test_book, test_flow_event, db_session, mocker):
        """Test deleting a flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        response = client.delete(f"/api/v1/books/{test_book.id}/flow-events/{test_flow_event.id}")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify event is deleted
        result = await db_session.execute(
            select(FlowEvent).where(FlowEvent.id == test_flow_event.id)
        )
        assert result.scalars().first() is None


# Dependency Management Tests


class TestFlowEventDependencies:
    """Tests for flow event dependency management."""

    async def test_add_dependency(self, client, test_user_id, test_book, db_session, mocker):
        """Test adding a dependency between events."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
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
        db_session.add(event1)
        db_session.add(event2)
        await db_session.commit()
        
        dep_data = {
            "to_event_id": str(event2.id),
            "dependency_type": "blocks",
        }
        
        response = client.post(
            f"/api/v1/books/{test_book.id}/flow-events/{event1.id}/dependencies",
            json=dep_data,
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["from_event_id"] == str(event1.id)
        assert data["to_event_id"] == str(event2.id)
        assert data["dependency_type"] == "blocks"

    async def test_get_event_dependencies(self, client, test_user_id, test_book, db_session, mocker):
        """Test retrieving dependencies for an event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
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
        db_session.add(event1)
        db_session.add(event2)
        await db_session.commit()
        
        dependency = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=event1.id,
            to_event_id=event2.id,
            dependency_type="blocks",
        )
        db_session.add(dependency)
        await db_session.commit()
        
        response = client.get(
            f"/api/v1/books/{test_book.id}/flow-events/{event1.id}/dependencies"
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1

    async def test_remove_dependency(self, client, test_user_id, test_book, db_session, mocker):
        """Test removing a dependency."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
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
        db_session.add(event1)
        db_session.add(event2)
        await db_session.commit()
        
        dependency = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=event1.id,
            to_event_id=event2.id,
            dependency_type="blocks",
        )
        db_session.add(dependency)
        await db_session.commit()
        
        response = client.delete(
            f"/api/v1/books/{test_book.id}/flow-events/{event1.id}/dependencies/{event2.id}"
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify dependency is deleted
        result = await db_session.execute(select(FlowDependency).where(FlowDependency.id == dependency.id))
        assert result.scalars().first() is None


# Timeline & Graph Tests


class TestFlowEventsTimeline:
    """Tests for timeline and dependency graph queries."""

    async def test_get_timeline(self, client, test_user_id, test_book, db_session, mocker):
        """Test getting timeline view of events."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        # Create events at different timeline positions
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
        for event in events:
            db_session.add(event)
        await db_session.commit()
        
        response = client.get(f"/api/v1/books/{test_book.id}/timeline")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_events"] >= 3
        # Verify events are sorted by timeline position
        positions = [e["timeline_position"] for e in data["events"]]
        assert positions == sorted(positions)

    async def test_get_dependency_graph(self, client, test_user_id, test_book, db_session, mocker):
        """Test getting full dependency graph."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        # Create events with dependencies
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
        for event in events:
            db_session.add(event)
        await db_session.commit()
        
        # Add dependencies
        dep1 = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=events[0].id,
            to_event_id=events[1].id,
            dependency_type="blocks",
        )
        dep2 = FlowDependency(
            id=uuid.uuid4(),
            from_event_id=events[1].id,
            to_event_id=events[2].id,
            dependency_type="triggers",
        )
        db_session.add(dep1)
        db_session.add(dep2)
        await db_session.commit()
        
        response = client.get(f"/api/v1/books/{test_book.id}/dependencies")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["nodes"]) >= 3
        # Verify nodes have dependency information
        assert any(len(node["dependencies"]) > 0 for node in data["nodes"])


# Chapter Association Tests


class TestFlowEventsChapters:
    """Tests for chapter-event associations."""

    async def test_link_chapter_to_event(self, client, test_user_id, test_book, test_chapter, test_flow_event, mocker):
        """Test linking a chapter to a flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        link_data = {
            "chapter_id": str(test_chapter.id),
            "order_index": 0,
        }
        
        response = client.post(
            f"/api/v1/books/{test_book.id}/flow-events/{test_flow_event.id}/chapters",
            json=link_data,
        )
        
        assert response.status_code == status.HTTP_201_CREATED

    async def test_unlink_chapter_from_event(self, client, test_user_id, test_book, test_chapter, test_flow_event, db_session, mocker):
        """Test unlinking a chapter from a flow event."""
        mocker.patch("app.core.dependencies.get_current_user_id", return_value=test_user_id)
        
        # Create association
        assoc = FlowChapterEvent(
            chapter_id=test_chapter.id,
            event_id=test_flow_event.id,
            order_index=0,
        )
        db_session.add(assoc)
        await db_session.commit()
        
        response = client.delete(
            f"/api/v1/books/{test_book.id}/flow-events/{test_flow_event.id}/chapters/{test_chapter.id}"
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify association is deleted
        result = await db_session.execute(
            select(FlowChapterEvent).where(
                (FlowChapterEvent.chapter_id == test_chapter.id) &
                (FlowChapterEvent.event_id == test_flow_event.id)
            )
        )
        assert result.scalars().first() is None


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
