"""
Models Tests
Tests for SQLAlchemy ORM models and database interactions
Covers User, Book, Chapter, Character, Audio, Transcription, Event models
"""

import pytest
from datetime import datetime, timedelta
from app.models.user import User
from app.models.book import Book
from app.models.chapter import Chapter


@pytest.mark.unit
@pytest.mark.models
class TestUserModel:
    """Test suite for User model"""

    def test_user_creation(self, test_db):
        """Test creating a new user"""
        user = User(
            email="testuser@example.com",
            username="testuser",
            hashed_password="hashed_pwd",
            role="USER",
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        assert user.id is not None
        assert user.email == "testuser@example.com"
        assert user.username == "testuser"
        assert user.role == "USER"
        assert user.is_active is True

    def test_user_timestamps(self, test_db):
        """Test user created_at and updated_at timestamps"""
        user = User(
            email="test@example.com",
            username="test",
            hashed_password="pwd",
        )
        test_db.add(user)
        test_db.commit()

        assert user.created_at is not None
        assert isinstance(user.created_at, datetime)

    def test_user_role_assignment(self, test_db):
        """Test different user roles"""
        admin = User(email="admin@ex.com", username="admin", hashed_password="pwd", role="ADMIN")
        user = User(email="user@ex.com", username="user", hashed_password="pwd", role="USER")

        test_db.add_all([admin, user])
        test_db.commit()

        assert admin.role == "ADMIN"
        assert user.role == "USER"

    def test_user_active_flag(self, test_db):
        """Test user active/inactive status"""
        user = User(
            email="test@ex.com",
            username="test",
            hashed_password="pwd",
            is_active=False,
        )
        test_db.add(user)
        test_db.commit()

        assert user.is_active is False


@pytest.mark.unit
@pytest.mark.models
class TestBookModel:
    """Test suite for Book model"""

    def test_book_creation(self, test_db, test_user):
        """Test creating a new book"""
        test_db.add(test_user)
        test_db.commit()

        book = Book(
            user_id=test_user.id,
            title="My Novel",
            description="A story about life",
            status="draft",
            genre="fiction",
            target_words=80000,
        )
        test_db.add(book)
        test_db.commit()
        test_db.refresh(book)

        assert book.id is not None
        assert book.title == "My Novel"
        assert book.status == "draft"

    def test_book_status_transitions(self, test_db, test_book):
        """Test book status field transitions"""
        test_db.add(test_book)
        test_db.commit()

        valid_statuses = ["draft", "in_progress", "review", "completed", "published"]
        for status in valid_statuses:
            test_book.status = status
            test_db.commit()
            assert test_book.status == status

    def test_book_word_count(self, test_db, test_book):
        """Test book word count tracking"""
        test_db.add(test_book)
        test_db.commit()

        test_book.total_words = 15000
        test_db.commit()

        assert test_book.total_words == 15000

    def test_book_genre_field(self, test_db, test_book):
        """Test book genre field"""
        genres = ["fiction", "non-fiction", "fantasy", "mystery", "romance"]
        test_db.add(test_book)
        test_db.commit()

        for genre in genres:
            test_book.genre = genre
            test_db.commit()
            assert test_book.genre == genre

    def test_book_deletion(self, test_db, test_book):
        """Test deleting a book"""
        test_db.add(test_book)
        test_db.commit()
        book_id = test_book.id

        test_db.delete(test_book)
        test_db.commit()

        deleted_book = test_db.query(Book).filter(Book.id == book_id).first()
        assert deleted_book is None


@pytest.mark.unit
@pytest.mark.models
class TestChapterModel:
    """Test suite for Chapter model"""

    def test_chapter_creation(self, test_db, test_chapter):
        """Test creating a chapter"""
        test_db.add(test_chapter)
        test_db.commit()
        test_db.refresh(test_chapter)

        assert test_chapter.id is not None
        assert test_chapter.title == "Chapter 1: Beginning"
        assert test_chapter.order == 1

    def test_chapter_word_count(self, test_db, test_chapter):
        """Test chapter word count calculation"""
        test_db.add(test_chapter)
        test_db.commit()

        assert test_chapter.word_count == 1500

    def test_chapter_content_update(self, test_db, test_chapter):
        """Test updating chapter content"""
        test_db.add(test_chapter)
        test_db.commit()

        updated_content = "Updated chapter content with more details..."
        test_chapter.content = updated_content
        test_db.commit()

        assert test_chapter.content == updated_content

    def test_chapter_ordering(self, test_db, test_book):
        """Test chapter ordering within a book"""
        test_db.add(test_book)
        test_db.commit()

        chapters = [
            Chapter(book_id=test_book.id, title=f"Chapter {i}", content="Content", order=i)
            for i in range(1, 4)
        ]
        test_db.add_all(chapters)
        test_db.commit()

        chapters_ordered = test_db.query(Chapter).filter_by(book_id=test_book.id).order_by(Chapter.order).all()
        assert len(chapters_ordered) == 3
        assert chapters_ordered[0].order == 1
        assert chapters_ordered[2].order == 3

    def test_chapter_status(self, test_db, test_chapter):
        """Test chapter status tracking"""
        test_db.add(test_chapter)
        test_db.commit()

        statuses = ["draft", "reviewing", "finalized"]
        for status in statuses:
            test_chapter.status = status
            test_db.commit()
            assert test_chapter.status == status


@pytest.mark.unit
@pytest.mark.models
class TestCharacterModel:
    """Test suite for Character model"""

    def test_character_creation(self, test_db, test_character):
        """Test creating a character"""
        test_db.add(test_character)
        test_db.commit()
        test_db.refresh(test_character)

        assert test_character.id is not None
        assert test_character.name == "Alice"
        assert test_character.role == "protagonist"

    def test_character_traits(self, test_db, test_character):
        """Test character traits array"""
        test_db.add(test_character)
        test_db.commit()

        assert "intelligent" in test_character.traits
        assert "brave" in test_character.traits
        assert len(test_character.traits) == 3

    def test_character_description(self, test_db, test_character):
        """Test character description"""
        test_db.add(test_character)
        test_db.commit()

        expected_desc = "A curious and brave protagonist"
        assert test_character.description == expected_desc

    def test_multiple_characters(self, test_db, test_book):
        """Test managing multiple characters in a book"""
        from app.models.chapter import Character

        test_db.add(test_book)
        test_db.commit()

        chars = [
            Character(book_id=test_book.id, name=f"Character {i}", role="supporting")
            for i in range(1, 4)
        ]
        test_db.add_all(chars)
        test_db.commit()

        book_characters = test_db.query(Character).filter_by(book_id=test_book.id).all()
        assert len(book_characters) == 3


@pytest.mark.unit
@pytest.mark.models
class TestAudioTranscriptionModel:
    """Test suite for Audio and Transcription models"""

    def test_audio_file_creation(self, test_db, test_audio_file):
        """Test creating an audio file record"""
        test_db.add(test_audio_file)
        test_db.commit()
        test_db.refresh(test_audio_file)

        assert test_audio_file.id is not None
        assert test_audio_file.filename == "recording.mp3"
        assert test_audio_file.file_size == 1024000

    def test_transcription_creation(self, test_db, test_transcription):
        """Test creating a transcription"""
        test_db.add(test_transcription)
        test_db.commit()
        test_db.refresh(test_transcription)

        assert test_transcription.id is not None
        assert test_transcription.status == "completed"
        assert test_transcription.confidence == 0.95

    def test_transcription_status_tracking(self, test_db, test_transcription):
        """Test transcription status progression"""
        test_db.add(test_transcription)
        test_db.commit()

        statuses = ["pending", "processing", "completed"]
        for status in statuses:
            test_transcription.status = status
            test_db.commit()
            assert test_transcription.status == status


@pytest.mark.unit
@pytest.mark.models
class TestEventModel:
    """Test suite for Event model"""

    def test_event_creation(self, test_db, test_event):
        """Test creating an event"""
        test_db.add(test_event)
        test_db.commit()
        test_db.refresh(test_event)

        assert test_event.id is not None
        assert test_event.title == "The Meeting"
        assert test_event.event_type == "narrative"

    def test_event_timeline(self, test_db, test_event):
        """Test event timeline ordering"""
        test_db.add(test_event)
        test_db.commit()

        assert test_event.start_date is not None
        assert isinstance(test_event.start_date, datetime)


@pytest.mark.unit
@pytest.mark.models
class TestReferenceModel:
    """Test suite for Reference model"""

    def test_reference_creation(self, test_db, test_reference):
        """Test creating a reference"""
        test_db.add(test_reference)
        test_db.commit()
        test_db.refresh(test_reference)

        assert test_reference.id is not None
        assert test_reference.title == "Historical Background"
        assert test_reference.url is not None

    def test_reference_notes(self, test_db, test_reference):
        """Test reference notes field"""
        test_db.add(test_reference)
        test_db.commit()

        assert "historical" in test_reference.notes.lower()
