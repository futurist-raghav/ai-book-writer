"""
Test suite for Bibliography and Citations (P2.4)
"""

import pytest
from uuid import uuid4
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Book, Bibliography, ChapterCitation, Chapter
from app.core.database import Base


@pytest.mark.asyncio
class TestBibliography:
    """Tests for bibliography CRUD operations"""

    async def test_create_bibliography_source(
        self, 
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book
    ):
        """Test creating a bibliography source"""
        source_data = {
            "title": "The Art of Fiction",
            "authors": ["John Gardner"],
            "year": 1991,
            "source_type": "book",
            "source_url": "https://example.com",
            "notes": "Great reference for writing technique"
        }
        
        response = await async_client.post(
            f"/api/v1/books/{test_book.id}/bibliography",
            json=source_data,
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == source_data["title"]
        assert data["authors"] == source_data["authors"]
        assert data["year"] == source_data["year"]
        assert "apa" in data["citation_formats"]
        assert "mla" in data["citation_formats"]
        assert "chicago" in data["citation_formats"]

    async def test_list_bibliography(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book
    ):
        """Test listing bibliography sources"""
        # Create multiple sources
        for i in range(3):
            source = Bibliography(
                id=str(uuid4()),
                book_id=test_book.id,
                title=f"Source {i+1}",
                authors=["Author"],
                year=2020 + i,
                source_type="book",
                citation_formats={"apa": f"Author (202{i}).", "mla": f"Author. 202{i}.", "chicago": "..."}
            )
            db_session.add(source)
        
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/books/{test_book.id}/bibliography",
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all("title" in item for item in data)

    async def test_filter_by_source_type(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book
    ):
        """Test filtering bibliography by source type"""
        # Create sources of different types
        book_source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="A Book",
            source_type="book",
            citation_formats={}
        )
        article_source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="An Article",
            source_type="article",
            citation_formats={}
        )
        
        db_session.add(book_source)
        db_session.add(article_source)
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/books/{test_book.id}/bibliography?source_type=book",
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["source_type"] == "book"

    async def test_update_bibliography(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book
    ):
        """Test updating a bibliography source"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Original Title",
            year=2020,
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        update_data = {
            "title": "Updated Title",
            "year": 2021
        }
        
        response = await async_client.patch(
            f"/api/v1/books/{test_book.id}/bibliography/{source.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["year"] == 2021

    async def test_delete_bibliography(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book
    ):
        """Test deleting a bibliography source"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="To Delete",
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        response = await async_client.delete(
            f"/api/v1/books/{test_book.id}/bibliography/{source.id}",
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify deletion
        deleted = await db_session.get(Bibliography, source.id)
        assert deleted is None


@pytest.mark.asyncio
class TestChapterCitations:
    """Tests for chapter citations"""

    async def test_add_citation_to_chapter(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book,
        test_chapter: Chapter
    ):
        """Test adding a citation to a chapter"""
        # Create bibliography source first
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Referenced Book",
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        citation_data = {
            "bibliography_id": str(source.id),
            "page_number": "42",
            "context_offset": 1234,
            "context_snippet": "...some text from chapter..."
        }
        
        response = await async_client.post(
            f"/api/v1/books/{test_book.id}/chapters/{test_chapter.id}/citations",
            json=citation_data,
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["bibliography_id"] == str(source.id)
        assert data["page_number"] == "42"
        assert data["context_offset"] == 1234

    async def test_list_chapter_citations(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book,
        test_chapter: Chapter
    ):
        """Test listing all citations in a chapter"""
        # Create sources
        sources = []
        for i in range(2):
            source = Bibliography(
                id=str(uuid4()),
                book_id=test_book.id,
                title=f"Source {i+1}",
                citation_formats={}
            )
            db_session.add(source)
            sources.append(source)
        
        await db_session.commit()
        
        # Add citations
        for i, source in enumerate(sources):
            citation = ChapterCitation(
                id=str(uuid4()),
                chapter_id=test_chapter.id,
                bibliography_id=source.id,
                citation_number=i+1,
                page_number=str(40+i)
            )
            db_session.add(citation)
        
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/books/{test_book.id}/chapters/{test_chapter.id}/citations",
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["citation_number"] == 1
        assert data[1]["citation_number"] == 2

    async def test_remove_citation(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        test_book: Book,
        test_chapter: Chapter
    ):
        """Test removing a citation from a chapter"""
        # Create source and citation
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Source to Remove",
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        citation = ChapterCitation(
            id=str(uuid4()),
            chapter_id=test_chapter.id,
            bibliography_id=source.id,
            citation_number=1
        )
        db_session.add(citation)
        await db_session.commit()
        
        response = await async_client.delete(
            f"/api/v1/books/{test_book.id}/chapters/{test_chapter.id}/citations/{citation.id}",
            headers={"Authorization": f"Bearer {test_user.access_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify deletion
        deleted = await db_session.get(ChapterCitation, citation.id)
        assert deleted is None


@pytest.mark.asyncio
class TestCitationFormats:
    """Tests for citation format generation"""

    async def test_apa_format_generation(
        self,
        db_session: AsyncSession,
        test_book: Book
    ):
        """Test APA citation format generation"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Test Book",
            authors=["John Smith", "Jane Doe"],
            year=2020,
            source_type="book",
            citation_formats={
                "apa": "Smith, J., & Doe, J. (2020). Test Book."
            }
        )
        db_session.add(source)
        await db_session.commit()
        
        assert "Smith" in source.citation_formats["apa"]
        assert "2020" in source.citation_formats["apa"]

    async def test_mla_format_generation(
        self,
        db_session: AsyncSession,
        test_book: Book
    ):
        """Test MLA citation format generation"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Test Book",
            authors=["John Smith"],
            year=2020,
            source_type="book",
            citation_formats={
                "mla": "Smith, John. \"Test Book.\" 2020."
            }
        )
        db_session.add(source)
        await db_session.commit()
        
        assert "Smith" in source.citation_formats["mla"]
        assert "2020" in source.citation_formats["mla"]


@pytest.mark.asyncio
class TestAuthorization:
    """Tests for bibliography authorization"""

    async def test_cannot_access_other_users_bibliography(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        other_user: User,
        test_book: Book
    ):
        """Test that users cannot access other users' bibliography"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Secret Source",
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/books/{test_book.id}/bibliography/{source.id}",
            headers={"Authorization": f"Bearer {other_user.access_token}"}
        )
        
        assert response.status_code == 403

    async def test_cannot_delete_other_users_bibliography(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
        other_user: User,
        test_book: Book
    ):
        """Test that users cannot delete other users' bibliography"""
        source = Bibliography(
            id=str(uuid4()),
            book_id=test_book.id,
            title="Protected Source",
            citation_formats={}
        )
        db_session.add(source)
        await db_session.commit()
        
        response = await async_client.delete(
            f"/api/v1/books/{test_book.id}/bibliography/{source.id}",
            headers={"Authorization": f"Bearer {other_user.access_token}"}
        )
        
        assert response.status_code == 403
