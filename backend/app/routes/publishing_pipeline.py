"""Publishing Pipeline Integration Routes for P7.2"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.middleware import verify_auth
from typing import Optional
from pydantic import BaseModel
import json

router = APIRouter(prefix="/publishing-pipeline", tags=["Publishing Pipeline"])


class KDPMetadata(BaseModel):
    """Amazon KDP specific metadata"""
    title: str
    subtitle: Optional[str] = None
    author: str
    description: str
    keywords: list[str]  # Up to 7
    categories: list[str]  # BISAC categories
    language: str = "English"
    isbn: Optional[str] = None
    series_name: Optional[str] = None
    series_number: Optional[int] = None


class IngramSparkMetadata(BaseModel):
    """IngramSpark specific metadata"""
    title: str
    author: str
    description: str
    isbn: str  # Required for IngramSpark
    publisher: str
    publication_date: str
    trim_size: str  # "5x8", "6x9", "8.5x11"
    page_count: int
    wholesale_discount: float  # 40-50% typical


class PublishingChecklist(BaseModel):
    """Pre-publishing verification checklist"""
    has_cover: bool
    cover_size_correct: bool
    manuscript_formatted: bool
    metadata_complete: bool
    isbn_obtained: bool
    pricing_set: bool
    distribution_selected: bool


@router.post("/validate-kdp-metadata")
async def validate_kdp_metadata(
    metadata: KDPMetadata,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(verify_auth)
):
    """Validate metadata meets KDP requirements"""
    
    errors = []
    warnings = []
    
    # Validations
    if not metadata.title or len(metadata.title) < 3 or len(metadata.title) > 200:
        errors.append("Title must be 3-200 characters")
    
    if not metadata.author or len(metadata.author) < 2 or len(metadata.author) > 200:
        errors.append("Author name must be 2-200 characters")
    
    if not metadata.description or len(metadata.description) < 10:
        errors.append("Description too short (minimum 10 characters)")
    
    if len(metadata.description) > 4000:
        errors.append("Description too long (maximum 4000 characters)")
    
    if len(metadata.keywords) > 7:
        errors.append(f"Too many keywords ({len(metadata.keywords)}). Limit: 7")
    
    if len(metadata.keywords) < 3:
        warnings.append("Recommended minimum 3 keywords for discoverability")
    
    if not metadata.categories:
        errors.append("At least one BISAC category required")
    
    if metadata.isbn and len(metadata.isbn.replace("-", "")) not in [10, 13]:
        errors.append("Invalid ISBN format")
    
    # Check for duplicate keywords
    if len(metadata.keywords) != len(set(metadata.keywords)):
        warnings.append("Some keywords are duplicated")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "metadata_score": (10 - len(errors)) / 10 * 100,
    }


@router.post("/validate-ingramspark-metadata")
async def validate_ingramspark_metadata(
    metadata: IngramSparkMetadata,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(verify_auth)
):
    """Validate metadata meets IngramSpark requirements"""
    
    errors = []
    warnings = []
    
    # ISBN validation (required for IngramSpark)
    if not metadata.isbn:
        errors.append("ISBN required for IngramSpark")
    elif len(metadata.isbn.replace("-", "")) not in [10, 13]:
        errors.append("Invalid ISBN format")
    
    if not metadata.title or len(metadata.title) < 3:
        errors.append("Title required (minimum 3 characters)")
    
    if not metadata.author:
        errors.append("Author name required")
    
    if not metadata.publisher:
        errors.append("Publisher name required")
    
    if len(metadata.description) < 10:
        errors.append("Description too short")
    
    if metadata.page_count < 10:
        errors.append("Minimum 10 pages required")
    
    if metadata.page_count > 5000:
        warnings.append("Very long manuscript - verify page count")
    
    # Trim size validation
    valid_sizes = ["5x8", "6x9", "8.5x11", "7x10", "8x10.25"]
    if metadata.trim_size not in valid_sizes:
        errors.append(f"Invalid trim size. Valid options: {', '.join(valid_sizes)}")
    
    # Wholesale discount check
    if metadata.wholesale_discount < 0.30:
        warnings.append("Wholesale discount below 30% - may reduce distributor interest")
    
    if metadata.wholesale_discount > 0.60:
        warnings.append("Wholesale discount above 60% - may reduce profit margin")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "metadata_score": (10 - len(errors)) / 10 * 100,
    }


@router.get("/export-template/{format}")
async def get_export_template(
    format: str,  # "kdp", "ingramspark", "draft2digital", "apple"
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(verify_auth)
):
    """Get publishing export template with requirements"""
    
    templates = {
        "kdp": {
            "platform": "Amazon KDP",
            "file_formats": ["DOCX", "PDF"],
            "cover_specs": {
                "ebook": "1600x2400px minimum, RGB JPG/PNG",
                "paperback": "varies by trim size + bleed"
            },
            "metadata_fields": [
                "title", "subtitle", "author", "description",
                "keywords (7)", "primary_category", "browse_categories",
                "language", "isbn", "series"
            ],
            "pricing": {
                "ebook": "1.99-200 USD in 0.99 increments",
                "paperback": "base_cost + author_margin"
            },
            "royalty_rates": {
                "ebook": "35% or 70% (KDP Select)",
                "paperback": "variable based on cost"
            },
            "best_for": "Maximum Amazon reach, high royalties"
        },
        "ingramspark": {
            "platform": "IngramSpark",
            "file_formats": ["PDF"],
            "cover_specs": {
                "print": "PDF with 0.125 inch bleed",
                "ebook": "1600x2400px JPG/PNG"
            },
            "metadata_fields": [
                "title", "author", "publisher", "isbn (required)",
                "publication_date", "description", "keywords",
                "bisac_category", "trim_size", "page_count"
            ],
            "pricing": {
                "print": "wholesale_discount * retail_price",
                "ebook": "author sets retail price"
            },
            "royalty_rates": {
                "print": "retail_price - production_cost - distributor_margin",
                "ebook": "50-70%"
            },
            "best_for": "Bookstore distribution, professional print"
        },
        "draft2digital": {
            "platform": "Draft2Digital",
            "file_formats": ["DOCX", "EPUB", "PDF"],
            "cover_specs": {
                "ebook": "1600x2400px minimum JPG/PNG"
            },
            "metadata_fields": [
                "title", "author", "description", "genre",
                "subgenre", "keywords (10)", "language",
                "retail_price", "copyright_year"
            ],
            "pricing": {
                "ebook": "author sets retail price"
            },
            "royalty_rates": {
                "ebook": "50-80% depeding on price point"
            },
            "best_for": "Multi-platform indie distribution, simplest setup"
        },
        "apple": {
            "platform": "Apple Books",
            "file_formats": ["EPUB"],
            "cover_specs": {
                "ebook": "1600x2400px JPG/PNG, RGB"
            },
            "metadata_fields": [
                "title", "subtitle", "author", "description",
                "publisher", "copyright", "language",
                "genre", "keywords", "retail_price"
            ],
            "pricing": {
                "ebook": "select from Apple tiered price list"
            },
            "royalty_rates": {
                "ebook": "70% in US Canada, 45% other territories"
            },
            "best_for": "Apple Books exclusive distribution"
        }
    }
    
    if format.lower() not in templates:
        raise HTTPException(status_code=400, detail=f"Unknown format: {format}")
    
    return templates[format.lower()]


@router.get("/checklist/{book_id}")
async def get_publishing_checklist(
    book_id: str,
    session: AsyncSession = Depends(get_session),
    user_id: str = Depends(verify_auth)
):
    """Generate pre-publishing checklist for a book"""
    
    # In real implementation, would query book from DB
    # For now, return template checklist
    
    return {
        "book_id": book_id,
        "checklist": {
            "manuscript": {
                "formatted": False,
                "proofread": False,
                "target_audience_appropriate": False
            },
            "cover": {
                "designed": False,
                "correct_dimensions": False,
                "professional_quality": False
            },
            "metadata": {
                "title_final": False,
                "description_complete": False,
                "keywords_selected": False,
                "category_selected": False,
                "isbn_obtained": False
            },
            "distribution": {
                "platform_selected": False,
                "pricing_set": False,
                "formatting_verified": False
            },
            "legal": {
                "copyright_registered": False,
                "rights_verified": False,
                "permissions_obtained": False
            }
        },
        "estimated_completion_percent": 0
    }
