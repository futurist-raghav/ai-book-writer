"""
API Routes Tests
Tests for FastAPI endpoints covering authentication, books, chapters, and AI  
Covers request validation, response status codes, and error handling
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from datetime import datetime

client = TestClient(app)


@pytest.mark.api
@pytest.mark.auth
class TestAuthenticationAPI:
    """Test suite for authentication endpoints"""

    def test_register_user(self):
        """Test user registration endpoint"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "password": "SecurePass123!",
            },
        )
        
        assert response.status_code in [201, 200]
        data = response.json()
        assert data["email"] == "newuser@example.com"

    def test_register_duplicate_email(self):
        """Test registration with duplicate email"""
        payload = {
            "email": "test@example.com",
            "username": "user1",
            "password": "pass123",
        }
        
        # First registration
        client.post("/api/v1/auth/register", json=payload)
        
        # Second registration with same email should fail
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 400

    def test_login_user(self, test_token):
        """Test user login endpoint"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "password123",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "wrongpass",
            },
        )
        
        assert response.status_code == 401

    def test_get_current_user(self, test_token):
        """Test getting current user profile"""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"

    def test_get_current_user_unauthorized(self):
        """Test getting current user without token"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_logout(self, test_token):
        """Test logout endpoint"""
        response = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 204


@pytest.mark.api
class TestBooksAPI:
    """Test suite for Books endpoints"""

    def test_get_books_list(self, test_token):
        """Test getting user's books"""
        response = client.get(
            "/api/v1/books",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_book(self, test_token):
        """Test creating a new book"""
        response = client.post(
            "/api/v1/books",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "title": "My New Novel",
                "description": "A story about adventure",
                "genre": "fantasy",
                "target_words": 80000,
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "My New Novel"
        assert data["status"] == "draft"

    def test_create_book_missing_title(self, test_token):
        """Test creating book without required title"""
        response = client.post(
            "/api/v1/books",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "description": "Missing title",
                "genre": "fiction",
            },
        )
        
        assert response.status_code == 422

    def test_get_book_details(self, test_token, test_book):
        """Test getting specific book details"""
        response = client.get(
            f"/api/v1/books/{test_book.id}",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_book.id
        assert data["title"] == test_book.title

    def test_get_nonexistent_book(self, test_token):
        """Test getting nonexistent book"""
        response = client.get(
            "/api/v1/books/nonexistent-id",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 404

    def test_update_book(self, test_token, test_book):
        """Test updating book details"""
        response = client.put(
            f"/api/v1/books/{test_book.id}",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "title": "Updated Title",
                "status": "in_progress",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    def test_delete_book(self, test_token, test_book):
        """Test deleting a book"""
        response = client.delete(
            f"/api/v1/books/{test_book.id}",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 204

    def test_filter_books_by_status(self, test_token):
        """Test filtering books by status"""
        response = client.get(
            "/api/v1/books?status=draft",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        for book in data:
            assert book["status"] == "draft"

    def test_paginate_books(self, test_token):
        """Test book list pagination"""
        response = client.get(
            "/api/v1/books?skip=0&limit=10",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10


@pytest.mark.api
class TestChaptersAPI:
    """Test suite for Chapters endpoints"""

    def test_get_chapters(self, test_token, test_book):
        """Test getting chapters for a book"""
        response = client.get(
            f"/api/v1/books/{test_book.id}/chapters",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_chapter(self, test_token, test_book):
        """Test creating a new chapter"""
        response = client.post(
            f"/api/v1/books/{test_book.id}/chapters",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "title": "Chapter 1: The Beginning",
                "content": "Once upon a time...",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Chapter 1: The Beginning"

    def test_get_chapter_details(self, test_token, test_chapter):
        """Test getting specific chapter"""
        response = client.get(
            f"/api/v1/chapters/{test_chapter.id}",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_chapter.id

    def test_update_chapter_content(self, test_token, test_chapter):
        """Test updating chapter content"""
        response = client.put(
            f"/api/v1/chapters/{test_chapter.id}",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "content": "Updated chapter content...",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "Updated" in data["content"]

    def test_delete_chapter(self, test_token, test_chapter):
        """Test deleting a chapter"""
        response = client.delete(
            f"/api/v1/chapters/{test_chapter.id}",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 204


@pytest.mark.api
class TestCharactersAPI:
    """Test suite for Characters endpoints"""

    def test_get_characters(self, test_token, test_book):
        """Test getting characters for a book"""
        response = client.get(
            f"/api/v1/books/{test_book.id}/characters",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_character(self, test_token, test_book):
        """Test creating a character"""
        response = client.post(
            f"/api/v1/books/{test_book.id}/characters",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "name": "Hero",
                "role": "protagonist",
                "description": "A brave hero",
                "traits": ["courageous", "intelligent"],
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Hero"

    def test_update_character(self, test_token, test_character):
        """Test updating character"""
        response = client.put(
            f"/api/v1/characters/{test_character.id}",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "role": "antagonist",
            },
        )
        
        assert response.status_code == 200


@pytest.mark.api
class TestAIAssistantAPI:
    """Test suite for AI Assistant endpoints"""

    def test_ai_chat(self, test_token, test_book):
        """Test AI chat endpoint"""
        response = client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "message": "Help me develop this character",
                "book_id": test_book.id,
                "type": "character",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_ai_suggestions(self, test_token, test_chapter):
        """Test AI suggestions endpoint"""
        response = client.post(
            "/api/v1/ai/suggestions",
            headers={"Authorization": f"Bearer {test_token}"},
            json={
                "chapter_id": test_chapter.id,
                "type": "dialogue",
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)


@pytest.mark.api
class TestAudioTranscriptionAPI:
    """Test suite for Audio and Transcription endpoints"""

    def test_upload_audio(self, test_token, test_book):
        """Test audio upload endpoint"""
        # This would require actual file upload
        # Implementation depends on your actual endpoint
        pass

    def test_get_transcription(self, test_token, test_transcription):
        """Test getting transcription"""
        response = client.get(
            f"/api/v1/transcriptions/{test_transcription.id}",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"


@pytest.mark.api
class TestErrorHandling:
    """Test suite for API error handling"""

    def test_missing_auth_header(self):
        """Test request without auth header"""
        response = client.get("/api/v1/books")
        assert response.status_code == 401

    def test_invalid_auth_token(self):
        """Test with invalid token"""
        response = client.get(
            "/api/v1/books",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_malformed_request(self, test_token):
        """Test with malformed JSON"""
        response = client.post(
            "/api/v1/books",
            headers={"Authorization": f"Bearer {test_token}"},
            data="invalid json",
            content_type="application/json",
        )
        assert response.status_code == 422

    def test_not_found_response(self, test_token):
        """Test 404 response"""
        response = client.get(
            "/api/v1/nonexistent-endpoint",
            headers={"Authorization": f"Bearer {test_token}"},
        )
        assert response.status_code == 404
