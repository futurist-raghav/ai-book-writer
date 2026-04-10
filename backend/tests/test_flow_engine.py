"""
Tests for Flow Engine API endpoints.
"""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.models import FlowEvent, FlowDependency, FlowChapterEvent

# Create test client (synchronous)
client = TestClient(app)


@pytest.mark.api
@pytest.mark.flow_engine
class TestFlowEngineAPI:
    """Test suite for flow engine endpoints"""

    def test_create_flow_event(self, test_book, test_token):
        """Test creating a new flow event."""
        headers = {"Authorization": f"Bearer {test_token}"}
        event_data = {
            "title": "Act 1 Introduction",
            "description": "Main character introduction",
            "event_type": "act",
            "timeline_position": 0,
            "duration": 1000,
            "status": "planned",
            "metadata": {"emoji": "🎬"},
        }

        response = client.post(
            f"/api/v1/books/{test_book.id}/events",
            json=event_data,
            headers=headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Act 1 Introduction"
        assert data["event_type"] == "act"
        assert data["status"] == "planned"
        assert data["metadata"]["emoji"] == "🎬"

    def test_list_flow_events(self, test_book, test_token):
        """Test listing flow events."""
        headers = {"Authorization": f"Bearer {test_token}"}

        response = client.get(
            f"/api/v1/books/{test_book.id}/events?limit=10",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "total_count" in data
        assert "has_more" in data

    def test_unauthorized_access_fails(self, test_book):
        """Test that requests without auth token fail."""
        response = client.get(
            f"/api/v1/books/{test_book.id}/events",
        )

        assert response.status_code in [401, 403]

    def test_non_existent_book_returns_403(self, test_token):
        """Test that accessing another user's book returns 403."""
        headers = {"Authorization": f"Bearer {test_token}"}
        fake_book_id = uuid4()

        response = client.get(
            f"/api/v1/books/{fake_book_id}/events",
            headers=headers,
        )

        assert response.status_code == 403

    def test_flow_event_pagination(self, test_book, test_token):
        """Test pagination parameter validation."""
        headers = {"Authorization": f"Bearer {test_token}"}

        # Test with limit=10
        response = client.get(
            f"/api/v1/books/{test_book.id}/events?limit=10&page=1",
            headers=headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["page"] == 1

    def test_timeline_endpoint(self, test_book, test_token):
        """Test getting timeline view."""
        headers = {"Authorization": f"Bearer {test_token}"}

        response = client.get(
            f"/api/v1/books/{test_book.id}/events/timeline",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "book_id" in data
        assert "total_events" in data
        assert "events" in data
        assert "timeline_range" in data
