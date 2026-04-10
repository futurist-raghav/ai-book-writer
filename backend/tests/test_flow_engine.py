"""
Tests for Flow Engine API endpoints.
"""

import pytest
from uuid import uuid4
from sqlalchemy import select
from app.models import FlowEvent, FlowDependency, FlowChapterEvent, Book, Chapter, User
from app.schemas.flow_engine import FlowEventCreateRequest, FlowDependencyCreateRequest


@pytest.mark.asyncio
async def test_create_flow_event(client, test_book, auth_header):
    """Test creating a new flow event."""
    event_data = {
        "title": "Act 1 Introduction",
        "description": "Main character introduction",
        "event_type": "act",
        "timeline_position": 0,
        "duration": 1000,
        "status": "planned",
        "metadata": {"emoji": "🎬"},
    }

    response = await client.post(
        f"/api/v1/books/{test_book.id}/events",
        json=event_data,
        headers=auth_header,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Act 1 Introduction"
    assert data["event_type"] == "act"
    assert data["status"] == "planned"
    assert data["metadata"]["emoji"] == "🎬"


@pytest.mark.asyncio
async def test_list_flow_events(client, test_book, auth_header, db):
    """Test listing flow events."""
    # Create some test events
    for i in range(5):
        event = FlowEvent(
            book_id=test_book.id,
            title=f"Event {i}",
            event_type="scene" if i % 2 == 0 else "beat",
            timeline_position=i * 100,
            duration=500,
            status="planned",
        )
        db.add(event)
    await db.commit()

    response = await client.get(
        f"/api/v1/books/{test_book.id}/events?limit=10",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 5
    assert data["total_count"] == 5
    assert data["has_more"] is False


@pytest.mark.asyncio
async def test_list_flow_events_with_filtering(client, test_book, auth_header, db):
    """Test filtering flow events by type and status."""
    # Create events with different types and statuses
    for i in range(3):
        event = FlowEvent(
            book_id=test_book.id,
            title=f"Scene {i}",
            event_type="scene",
            timeline_position=i * 100,
            duration=500,
            status="planned",
        )
        db.add(event)

    for i in range(2):
        event = FlowEvent(
            book_id=test_book.id,
            title=f"Beat {i}",
            event_type="beat",
            timeline_position=400 + i * 100,
            duration=300,
            status="in_progress",
        )
        db.add(event)

    await db.commit()

    # Filter by type
    response = await client.get(
        f"/api/v1/books/{test_book.id}/events?event_type=scene&limit=10",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 3
    assert all(evt["event_type"] == "scene" for evt in data["events"])

    # Filter by status
    response = await client.get(
        f"/api/v1/books/{test_book.id}/events?status=in_progress&limit=10",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 2


@pytest.mark.asyncio
async def test_get_flow_event_detail(client, test_book, auth_header, db):
    """Test getting a single flow event with details."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Opening Scene",
        description="The beginning",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="completed",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    response = await client.get(
        f"/api/v1/books/{test_book.id}/events/{event.id}",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(event.id)
    assert data["title"] == "Opening Scene"
    assert data["status"] == "completed"
    assert data["chapter_count"] == 0


@pytest.mark.asyncio
async def test_get_timeline(client, test_book, auth_header, db):
    """Test getting chronological timeline view."""
    # Create events with various timeline positions
    events = []
    for i, pos in enumerate([100, 200, 50, 300]):
        event = FlowEvent(
            book_id=test_book.id,
            title=f"Event {i}",
            event_type="scene",
            timeline_position=pos,
            duration=500,
            status="planned",
        )
        db.add(event)
        events.append(event)

    await db.commit()

    response = await client.get(
        f"/api/v1/books/{test_book.id}/events/timeline",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_events"] == 4
    assert data["book_id"] == str(test_book.id)

    # Check events are ordered by timeline_position
    positions = [evt["timeline_position"] for evt in data["events"]]
    assert positions == sorted(positions)


@pytest.mark.asyncio
async def test_update_flow_event(client, test_book, auth_header, db):
    """Test updating a flow event."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Original Title",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    update_data = {
        "title": "Updated Title",
        "status": "in_progress",
        "duration": 1000,
    }

    response = await client.patch(
        f"/api/v1/books/{test_book.id}/events/{event.id}",
        json=update_data,
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["status"] == "in_progress"
    assert data["duration"] == 1000


@pytest.mark.asyncio
async def test_delete_flow_event(client, test_book, auth_header, db):
    """Test deleting a flow event."""
    event = FlowEvent(
        book_id=test_book.id,
        title="To Delete",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()
    event_id = event.id

    response = await client.delete(
        f"/api/v1/books/{test_book.id}/events/{event_id}",
        headers=auth_header,
    )

    assert response.status_code == 204

    # Verify deletion
    stmt = select(FlowEvent).where(FlowEvent.id == event_id)
    deleted_event = await db.scalar(stmt)
    assert deleted_event is None


@pytest.mark.asyncio
async def test_create_dependency_valid(client, test_book, auth_header, db):
    """Test creating a valid dependency between events."""
    event1 = FlowEvent(
        book_id=test_book.id,
        title="Event 1",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    event2 = FlowEvent(
        book_id=test_book.id,
        title="Event 2",
        event_type="scene",
        timeline_position=100,
        duration=500,
        status="planned",
    )
    db.add_all([event1, event2])
    await db.commit()
    await db.refresh(event1)
    await db.refresh(event2)

    dep_data = {
        "to_event_id": str(event2.id),
        "dependency_type": "blocks",
        "metadata": {"reason": "event1 must complete first"},
    }

    response = await client.post(
        f"/api/v1/books/{test_book.id}/events/{event1.id}/dependencies",
        json=dep_data,
        headers=auth_header,
    )

    assert response.status_code == 201
    data = response.json()
    assert str(data["from_event_id"]) == str(event1.id)
    assert str(data["to_event_id"]) == str(event2.id)
    assert data["dependency_type"] == "blocks"


@pytest.mark.asyncio
async def test_create_self_dependency_fails(client, test_book, auth_header, db):
    """Test that self-dependencies are prevented."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Event",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    dep_data = {
        "to_event_id": str(event.id),
        "dependency_type": "blocks",
    }

    response = await client.post(
        f"/api/v1/books/{test_book.id}/events/{event.id}/dependencies",
        json=dep_data,
        headers=auth_header,
    )

    assert response.status_code == 400
    assert "self-dependency" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_dependencies(client, test_book, auth_header, db):
    """Test getting dependencies for an event."""
    event1 = FlowEvent(
        book_id=test_book.id,
        title="Event 1",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    event2 = FlowEvent(
        book_id=test_book.id,
        title="Event 2",
        event_type="scene",
        timeline_position=100,
        duration=500,
        status="planned",
    )
    event3 = FlowEvent(
        book_id=test_book.id,
        title="Event 3",
        event_type="scene",
        timeline_position=200,
        duration=500,
        status="planned",
    )
    db.add_all([event1, event2, event3])
    await db.commit()
    await db.flush()

    # Create dependencies: event1 -> event2 -> event3
    dep1 = FlowDependency(
        from_event_id=event1.id,
        to_event_id=event2.id,
        dependency_type="blocks",
    )
    dep2 = FlowDependency(
        from_event_id=event2.id,
        to_event_id=event3.id,
        dependency_type="triggers",
    )
    db.add_all([dep1, dep2])
    await db.commit()

    # Get dependencies for event2 (has incoming and outgoing)
    response = await client.get(
        f"/api/v1/books/{test_book.id}/events/{event2.id}/dependencies",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["incoming"]) == 1  # From event1
    assert len(data["outgoing"]) == 1  # To event3


@pytest.mark.asyncio
async def test_delete_dependency(client, test_book, auth_header, db):
    """Test deleting a dependency."""
    event1 = FlowEvent(
        book_id=test_book.id,
        title="Event 1",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    event2 = FlowEvent(
        book_id=test_book.id,
        title="Event 2",
        event_type="scene",
        timeline_position=100,
        duration=500,
        status="planned",
    )
    db.add_all([event1, event2])
    await db.commit()
    await db.flush()

    dep = FlowDependency(
        from_event_id=event1.id,
        to_event_id=event2.id,
        dependency_type="blocks",
    )
    db.add(dep)
    await db.commit()

    response = await client.delete(
        f"/api/v1/books/{test_book.id}/events/{event1.id}/dependencies/{event2.id}",
        headers=auth_header,
    )

    assert response.status_code == 204

    # Verify deletion
    stmt = select(FlowDependency).where(
        (FlowDependency.from_event_id == event1.id)
        & (FlowDependency.to_event_id == event2.id)
    )
    deleted_dep = await db.scalar(stmt)
    assert deleted_dep is None


@pytest.mark.asyncio
async def test_link_chapter_to_event(client, test_book, test_chapter, auth_header, db):
    """Test linking a chapter to an event."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Event",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    link_data = {
        "chapter_id": str(test_chapter.id),
        "order_index": 1,
    }

    response = await client.post(
        f"/api/v1/books/{test_book.id}/events/{event.id}/chapters",
        json=link_data,
        headers=auth_header,
    )

    assert response.status_code == 201
    data = response.json()
    assert str(data["chapter_id"]) == str(test_chapter.id)
    assert str(data["event_id"]) == str(event.id)
    assert data["order_index"] == 1


@pytest.mark.asyncio
async def test_unlink_chapter_from_event(client, test_book, test_chapter, auth_header, db):
    """Test unlinking a chapter from an event."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Event",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()
    await db.flush()

    link = FlowChapterEvent(
        chapter_id=test_chapter.id,
        event_id=event.id,
        order_index=1,
    )
    db.add(link)
    await db.commit()

    response = await client.delete(
        f"/api/v1/books/{test_book.id}/events/{event.id}/chapters/{test_chapter.id}",
        headers=auth_header,
    )

    assert response.status_code == 204

    # Verify deletion
    stmt = select(FlowChapterEvent).where(
        (FlowChapterEvent.chapter_id == test_chapter.id)
        & (FlowChapterEvent.event_id == event.id)
    )
    deleted_link = await db.scalar(stmt)
    assert deleted_link is None


@pytest.mark.asyncio
async def test_flow_event_pagination(client, test_book, auth_header, db):
    """Test pagination of flow events."""
    # Create 25 events
    for i in range(25):
        event = FlowEvent(
            book_id=test_book.id,
            title=f"Event {i:03d}",
            event_type="scene",
            timeline_position=i * 100,
            duration=500,
            status="planned",
        )
        db.add(event)
    await db.commit()

    # Get first page (limit 10)
    response = await client.get(
        f"/api/v1/books/{test_book.id}/events?limit=10&page=1",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 10
    assert data["total_count"] == 25
    assert data["has_more"] is True

    # Get second page
    response = await client.get(
        f"/api/v1/books/{test_book.id}/events?limit=10&page=2",
        headers=auth_header,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 10
    assert data["page"] == 2


@pytest.mark.asyncio
async def test_unauthorized_access_fails(client, test_book, auth_header, other_user_header, db):
    """Test that other users cannot access another book's events."""
    event = FlowEvent(
        book_id=test_book.id,
        title="Event",
        event_type="scene",
        timeline_position=0,
        duration=500,
        status="planned",
    )
    db.add(event)
    await db.commit()

    response = await client.get(
        f"/api/v1/books/{test_book.id}/events",
        headers=other_user_header,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_non_existent_event_returns_404(client, test_book, auth_header):
    """Test that getting a non-existent event returns 404."""
    fake_id = uuid4()

    response = await client.get(
        f"/api/v1/books/{test_book.id}/events/{fake_id}",
        headers=auth_header,
    )

    assert response.status_code == 404
