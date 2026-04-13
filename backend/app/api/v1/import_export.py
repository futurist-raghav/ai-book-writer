"""Import/Export router (P2.7) - Handle file uploads, preview, apply"""

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime
import tempfile

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.import_source import ImportSource, ImportedContent, ImportFormat, ImportStatus
from app.schemas.import_schemas import (
    ImportFormatEnum,
    ImportedSectionResponse,
    ImportPreviewResponse,
    ImportApplyRequest,
    ImportApplyResponse,
    ImportSourceResponse,
    ImportListResponse,
)
from app.services.import_parsers import (
    MarkdownParser,
    FountainParser,
    DOCXParser,
    PlainTextParser,
)
from app.services.export_generators import (
    MarkdownExporter,
    TextExporter,
    DOCXExporter,
)
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter(tags=["import_export"])

# Storage path for uploads
UPLOAD_DIR = "/app/storage/imports"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_file_storage_path(book_id: int, filename: str) -> str:
    """Get safe storage path for uploaded file"""
    book_dir = os.path.join(UPLOAD_DIR, str(book_id))
    os.makedirs(book_dir, exist_ok=True)
    return os.path.join(book_dir, filename)


def detect_format(filename: str, content_preview: bytes) -> str:
    """Detect import format from filename and content"""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == ".docx":
        return "docx"
    elif ext in [".md", ".markdown"]:
        return "markdown"
    elif ext == ".fountain":
        return "fountain"
    else:
        # Try to detect from content
        try:
            preview_text = content_preview[:500].decode('utf-8', errors='ignore')
            if "INT." in preview_text or "EXT." in preview_text:
                return "fountain"
            elif "#" in preview_text:
                return "markdown"
        except:
            pass
        return "text"


async def parse_import_file(format: str, file_path: str) -> tuple[dict, List]:
    """Parse file and return (structure, sections)"""
    
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    if format == "docx":
        try:
            from docx import Document
            doc = Document(file_path)
            paragraphs_list = [
                {
                    'text': p.text,
                    'style': p.style.name if p.style else None,
                    'is_heading': p.style and 'Heading' in p.style.name,
                    'heading_level': int(p.style.name.split()[-1]) if p.style and 'Heading' in p.style.name else 0,
                }
                for p in doc.paragraphs
            ]
            structure = DOCXParser.estimate_structure(paragraphs_list)
            sections = DOCXParser.parse(paragraphs_list, split_by="heading1")
        except ImportError:
            raise HTTPException(status_code=400, detail="DOCX parsing requires python-docx")
    
    elif format == "markdown":
        text_content = file_content.decode('utf-8')
        structure = MarkdownParser.estimate_structure(text_content)
        sections = MarkdownParser.parse(text_content, split_by="h1")
    
    elif format == "fountain":
        text_content = file_content.decode('utf-8')
        structure = FountainParser.estimate_structure(text_content)
        sections = FountainParser.parse(text_content)
    
    else:  # text
        text_content = file_content.decode('utf-8')
        structure = PlainTextParser.estimate_structure(text_content)
        sections = PlainTextParser.parse(text_content)
    
    return structure, sections


@router.post("/{book_id}/import/upload", response_model=ImportSourceResponse)
async def upload_import(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload and analyze import file"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file size (limit 50MB)
    file_size = 0
    content_preview = b""
    
    try:
        file_path = get_file_storage_path(book_id, file.filename)
        with open(file_path, 'wb') as f:
            while True:
                chunk = await file.read(8192)
                if not chunk:
                    break
                f.write(chunk)
                file_size += len(chunk)
                if len(content_preview) < 1000:
                    content_preview += chunk
                
                if file_size > 52428800:  # 50MB
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")
    
    # Detect format
    try:
        detected_format = detect_format(file.filename, content_preview)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Format detection failed: {str(e)}")
    
    # Parse and analyze
    try:
        structure, sections = await parse_import_file(detected_format, file_path)
        total_characters = sum(len(s.content) for s in sections)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Parse failed: {str(e)}")
    
    # Create import source
    import_source = ImportSource(
        book_id=book_id,
        filename=file.filename,
        format=detected_format,
        status=ImportStatus.PREVIEW,
        file_size=file_size,
        total_characters=total_characters,
        detected_structure=structure,
        import_settings={"split_by": "auto"},
    )
    db.add(import_source)
    db.flush()  # Get ID
    
    # Store imported content sections
    for idx, section in enumerate(sections):
        imported = ImportedContent(
            import_source_id=import_source.id,
            section_index=idx,
            title=section.title,
            content=section.content,
            content_type="text",
            estimated_word_count=section.word_count,
        )
        db.add(imported)
    
    db.commit()
    db.refresh(import_source)
    
    return ImportSourceResponse.from_orm(import_source)


@router.get("/{source_id}/preview", response_model=ImportPreviewResponse)
async def get_import_preview(
    book_id: int,
    source_id: int,
    limit: int = Query(50, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get import preview with sections"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get import source
    source = db.query(ImportSource).filter(
        ImportSource.id == source_id,
        ImportSource.book_id == book_id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Import not found")
    
    # Get sections
    sections = db.query(ImportedContent).filter(
        ImportedContent.import_source_id == source_id,
    ).order_by(ImportedContent.section_index).limit(limit).all()
    
    # Calculate totals
    total_word_count = sum(s.estimated_word_count for s in sections)
    
    return ImportPreviewResponse(
        source_id=source.id,
        filename=source.filename,
        format=source.format,
        total_sections=len(sections),
        total_word_count=total_word_count,
        detected_structure=source.detected_structure,
        sections=[ImportedSectionResponse.from_orm(s) for s in sections],
    )


@router.post("/{book_id}/import/{source_id}/apply", response_model=ImportApplyResponse)
async def apply_import(
    book_id: int,
    source_id: int,
    request: ImportApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply import and create chapters"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get import source
    source = db.query(ImportSource).filter(
        ImportSource.id == source_id,
        ImportSource.book_id == book_id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Import not found")
    
    # Get sections to import
    query = db.query(ImportedContent).filter(
        ImportedContent.import_source_id == source_id,
    ).order_by(ImportedContent.section_index)
    
    if request.section_indices:
        query = query.filter(ImportedContent.section_index.in_(request.section_indices))
    
    sections = query.all()
    if not sections:
        raise HTTPException(status_code=400, detail="No sections selected")
    
    # Get or create parent
    parent_part = None
    next_chapter_number = request.start_at_chapter_number
    
    if request.parent_part_id:
        parent_part = db.query(Part).filter(
            Part.id == request.parent_part_id,
            Part.book_id == book_id,
        ).first()
        if not parent_part:
            raise HTTPException(status_code=404, detail="Part not found")
    
    # Create chapters
    created_chapters = []
    total_word_count = 0
    
    try:
        for section in sections:
            chapter = Chapter(
                book_id=book_id,
                title=section.title,
                content=section.content,
                chapter_number=next_chapter_number,
                part_id=parent_part.id if parent_part else None,
                status="draft",
            )
            db.add(chapter)
            db.flush()
            
            created_chapters.append(chapter.id)
            next_chapter_number += 1
            total_word_count += section.estimated_word_count
        
        # Update import source
        source.status = ImportStatus.COMPLETED
        source.updated_at = datetime.utcnow()
        
        db.commit()
        
        return ImportApplyResponse(
            import_source_id=source.id,
            chapters_created=len(created_chapters),
            total_word_count=total_word_count,
            created_chapter_ids=created_chapters,
        )
    
    except Exception as e:
        db.rollback()
        source.status = ImportStatus.FAILED
        source.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.get("", response_model=List[ImportListResponse])
async def list_imports(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List import sources for book"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    sources = db.query(ImportSource).filter(
        ImportSource.book_id == book_id,
    ).order_by(ImportSource.created_at.desc()).all()
    
    return [ImportListResponse.from_orm(s) for s in sources]


@router.get("/{source_id}", response_model=ImportSourceResponse)
async def get_import_source(
    book_id: int,
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get import source details"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    source = db.query(ImportSource).filter(
        ImportSource.id == source_id,
        ImportSource.book_id == book_id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Import not found")
    
    return ImportSourceResponse.from_orm(source)


@router.delete("/{source_id}")
async def delete_import_source(
    book_id: int,
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete import source and cleanup"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    source = db.query(ImportSource).filter(
        ImportSource.id == source_id,
        ImportSource.book_id == book_id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Import not found")
    
    # Delete from DB
    db.query(ImportedContent).filter(
        ImportedContent.import_source_id == source_id
    ).delete()
    db.delete(source)
    db.commit()
    
    # Clean up file
    file_path = get_file_storage_path(book_id, source.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except:
            pass
    
    return {"status": "deleted"}


# ============================================================================
# EXPORT ENDPOINTS (P2.7 Phase 2)
# ============================================================================

@router.post("/{book_id}/export/markdown")
async def export_to_markdown(
    book_id: int,
    include_metadata: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export book to Markdown format"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get all chapters
    chapters = db.query(Chapter).filter(
        Chapter.book_id == book_id,
    ).order_by(Chapter.chapter_number).all()
    
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters to export")
    
    # Prepare book data
    book_data = {
        'id': str(book.id),
        'title': book.title,
        'description': book.description,
        'authors': [book.author.full_name] if book.author else [],
        'status': book.status,
    }
    
    # Prepare chapters data
    chapters_data = [
        {
            'title': ch.title,
            'content': ch.content or '',
            'chapter_number': ch.chapter_number,
            'part_name': ch.part.title if ch.part else None,
        }
        for ch in chapters
    ]
    
    # Generate markdown
    md_content = MarkdownExporter.export(book_data, chapters_data, include_metadata)
    
    # Return as file
    filename = f"{book.title.replace(' ', '_')}.md"
    return StreamingResponse(
        iter([md_content.encode('utf-8')]),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/{book_id}/export/text")
async def export_to_text(
    book_id: int,
    include_metadata: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export book to plain text format"""
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get all chapters
    chapters = db.query(Chapter).filter(
        Chapter.book_id == book_id,
    ).order_by(Chapter.chapter_number).all()
    
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters to export")
    
    # Prepare book data
    book_data = {
        'id': str(book.id),
        'title': book.title,
        'description': book.description,
        'authors': [book.author.full_name] if book.author else [],
        'status': book.status,
    }
    
    # Prepare chapters data
    chapters_data = [
        {
            'title': ch.title,
            'content': ch.content or '',
            'chapter_number': ch.chapter_number,
            'part_name': ch.part.title if ch.part else None,
        }
        for ch in chapters
    ]
    
    # Generate text
    text_content = TextExporter.export(book_data, chapters_data, include_metadata)
    
    # Return as file
    filename = f"{book.title.replace(' ', '_')}.txt"
    return StreamingResponse(
        iter([text_content.encode('utf-8')]),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/{book_id}/export/docx")
async def export_to_docx(
    book_id: int,
    include_metadata: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export book to DOCX format"""
    
    try:
        from docx import Document  # Check if available
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="DOCX export requires python-docx. Contact administrator.",
        )
    
    # Verify book access
    book = db.query(Book).filter(
        Book.id == book_id,
        Book.author_id == current_user.id,
    ).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get all chapters
    chapters = db.query(Chapter).filter(
        Chapter.book_id == book_id,
    ).order_by(Chapter.chapter_number).all()
    
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters to export")
    
    # Prepare book data
    book_data = {
        'id': str(book.id),
        'title': book.title,
        'description': book.description,
        'authors': [book.author.full_name] if book.author else [],
        'status': book.status,
    }
    
    # Prepare chapters data
    chapters_data = [
        {
            'title': ch.title,
            'content': ch.content or '',
            'chapter_number': ch.chapter_number,
            'part_name': ch.part.title if ch.part else None,
        }
        for ch in chapters
    ]
    
    # Generate DOCX
    docx_bytes = DOCXExporter.export(book_data, chapters_data, include_metadata)
    
    # Return as file
    filename = f"{book.title.replace(' ', '_')}.docx"
    return StreamingResponse(
        iter([docx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
