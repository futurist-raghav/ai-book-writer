"""
Formatting Themes Endpoints

Create, manage, and apply formatting themes to books.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AsyncSessionDep, get_current_user
from app.models.book import Book
from app.models.formatting_theme import FormattingTheme, ThemePreset
from app.models.user import User
from app.schemas.formatting_theme import (
    FormattingThemeCreate,
    FormattingThemeUpdate,
    FormattingThemeResponse,
    ThemePresetResponse,
    BookThemesResponse,
)


router = APIRouter(prefix="/books/{book_id}", tags=["Formatting Themes"])


# Built-in theme presets
PRESET_THEMES = [
    {
        "slug": "novel-classic",
        "display_name": "Novel - Classic",
        "category": "novel",
        "description": "Elegant serif font, generous margins, refined typography",
        "config": {
            "body_font_family": "Garamond",
            "body_font_size": 12,
            "heading1_font_size": 24,
            "line_height": "1.6",
            "text_color": "#000000",
            "heading_color": "#000000",
            "margin_top": "1.25in",
            "margin_bottom": "1.25in",
            "margin_left": "1in",
            "margin_right": "1in",
        }
    },
    {
        "slug": "novel-modern",
        "display_name": "Novel - Modern",
        "category": "novel",
        "description": "Clean sans-serif, contemporary spacing, minimal ornamentation",
        "config": {
            "body_font_family": "Georgia",
            "body_font_size": 11,
            "heading1_font_size": 20,
            "line_height": "1.5",
            "text_color": "#1a1a1a",
            "heading_color": "#1a1a1a",
            "margin_top": "1in",
            "margin_bottom": "1in",
            "margin_left": "0.75in",
            "margin_right": "0.75in",
        }
    },
    {
        "slug": "academic-formal",
        "display_name": "Academic - Formal",
        "category": "academic",
        "description": "Double-spaced, Times New Roman, formal academic style",
        "config": {
            "body_font_family": "Times New Roman",
            "body_font_size": 12,
            "heading1_font_size": 16,
            "line_height": "2.0",
            "text_color": "#000000",
            "heading_color": "#000000",
            "margin_top": "1in",
            "margin_bottom": "1in",
            "margin_left": "1in",
            "margin_right": "1in",
        }
    },
    {
        "slug": "screenplay-standard",
        "display_name": "Screenplay - Standard",
        "category": "screenplay",
        "description": "Courier, industry-standard screenplay formatting",
        "config": {
            "body_font_family": "Courier New",
            "body_font_size": 12,
            "heading1_font_size": 12,
            "line_height": "1.0",
            "text_color": "#000000",
            "heading_color": "#000000",
            "margin_top": "1in",
            "margin_bottom": "1in",
            "margin_left": "1.5in",
            "margin_right": "1in",
        }
    },
    {
        "slug": "textbook-clean",
        "display_name": "Textbook - Clean",
        "category": "textbook",
        "description": "Clear hierarchy, generous margins for annotations",
        "config": {
            "body_font_family": "Georgia",
            "body_font_size": 11,
            "heading1_font_size": 18,
            "heading2_font_size": 15,
            "line_height": "1.6",
            "text_color": "#1a1a1a",
            "heading_color": "#003366",
            "margin_top": "1.25in",
            "margin_bottom": "1.25in",
            "margin_left": "1.5in",
            "margin_right": "1.25in",
        }
    },
    {
        "slug": "poetry-minimal",
        "display_name": "Poetry - Minimal",
        "category": "poetry",
        "description": "Centered layout, minimal margins, focus on text",
        "config": {
            "body_font_family": "Garamond",
            "body_font_size": 13,
            "heading1_font_size": 16,
            "line_height": "1.8",
            "text_color": "#000000",
            "heading_color": "#000000",
            "margin_top": "1.5in",
            "margin_bottom": "1.5in",
            "margin_left": "1.25in",
            "margin_right": "1.25in",
        }
    },
]


@router.get("/themes/presets", response_model=list[ThemePresetResponse])
async def get_theme_presets(
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get available theme presets.
    
    Returns built-in formatting themes users can apply to their books.
    """
    # Check database for presets, seed if empty
    presets_result = await session.execute(select(ThemePreset))
    presets = presets_result.scalars().all()
    
    # If no presets in DB, seed them
    if not presets:
        for preset_data in PRESET_THEMES:
            preset = ThemePreset(
                slug=preset_data["slug"],
                display_name=preset_data["display_name"],
                category=preset_data["category"],
                description=preset_data["description"],
                config=preset_data["config"],
                order_index=PRESET_THEMES.index(preset_data),
            )
            session.add(preset)
        await session.commit()
        
        # Re-fetch
        presets_result = await session.execute(select(ThemePreset).order_by(ThemePreset.order_index))
        presets = presets_result.scalars().all()
    
    return [ThemePresetResponse.from_attributes(p) for p in presets]


@router.get("/themes", response_model=BookThemesResponse)
async def get_book_themes(
    book_id: UUID,
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get all themes for a book (custom + available presets).
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    if not book_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get custom themes
    custom_result = await session.execute(
        select(FormattingTheme).where(FormattingTheme.book_id == book_id)
    )
    custom_themes = custom_result.scalars().all()
    
    # Get presets
    presets_result = await session.execute(
        select(ThemePreset).order_by(ThemePreset.order_index)
    )
    presets = presets_result.scalars().all()
    
    return BookThemesResponse(
        book_id=book_id,
        custom_themes=[FormattingThemeResponse.from_attributes(t) for t in custom_themes],
        presets=[ThemePresetResponse.from_attributes(p) for p in presets],
    )


@router.post("/themes", response_model=FormattingThemeResponse)
async def create_theme(
    book_id: UUID,
    theme: FormattingThemeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Create a custom formatting theme.
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    if not book_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Create theme
    db_theme = FormattingTheme(
        book_id=book_id,
        name=theme.name,
        description=theme.description,
        theme_type=theme.theme_type,
        is_custom=True,
        is_preset=False,
        body_font_family=theme.body_font_family,
        body_font_size=theme.body_font_size,
        heading1_font_family=theme.heading1_font_family,
        heading1_font_size=theme.heading1_font_size,
        heading2_font_size=theme.heading2_font_size,
        heading3_font_size=theme.heading3_font_size,
        line_height=theme.line_height,
        text_color=theme.text_color,
        background_color=theme.background_color,
        heading_color=theme.heading_color,
        accent_color=theme.accent_color,
        margin_top=theme.margin_top,
        margin_bottom=theme.margin_bottom,
        margin_left=theme.margin_left,
        margin_right=theme.margin_right,
        paragraph_indent=theme.paragraph_indent,
    )
    
    session.add(db_theme)
    await session.commit()
    await session.refresh(db_theme)
    
    return FormattingThemeResponse.from_attributes(db_theme)


@router.get("/themes/{theme_id}", response_model=FormattingThemeResponse)
async def get_theme(
    book_id: UUID,
    theme_id: UUID,
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific theme.
    """
    theme_result = await session.execute(
        select(FormattingTheme).where(
            FormattingTheme.id == theme_id,
            FormattingTheme.book_id == book_id,
        )
    )
    theme = theme_result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    return FormattingThemeResponse.from_attributes(theme)


@router.patch("/themes/{theme_id}", response_model=FormattingThemeResponse)
async def update_theme(
    book_id: UUID,
    theme_id: UUID,
    theme_update: FormattingThemeUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Update a formatting theme.
    """
    theme_result = await session.execute(
        select(FormattingTheme).where(
            FormattingTheme.id == theme_id,
            FormattingTheme.book_id == book_id,
        )
    )
    theme = theme_result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    # Update fields
    update_data = theme_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(theme, field, value)
    
    await session.commit()
    await session.refresh(theme)
    
    return FormattingThemeResponse.from_attributes(theme)


@router.delete("/themes/{theme_id}")
async def delete_theme(
    book_id: UUID,
    theme_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Delete a custom formatting theme.
    """
    theme_result = await session.execute(
        select(FormattingTheme).where(
            FormattingTheme.id == theme_id,
            FormattingTheme.book_id == book_id,
        )
    )
    theme = theme_result.scalar_one_or_none()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    await session.delete(theme)
    await session.commit()
    
    return {"success": True, "message": "Theme deleted"}


@router.post("/themes/{theme_id}/apply")
async def apply_theme(
    book_id: UUID,
    theme_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Apply a theme to the book (set as active).
    
    Stores theme_id on the book for use in compile/export.
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # If custom theme, verify it exists
    if theme_id != UUID(int=0):  # Theme ID provided
        theme_result = await session.execute(
            select(FormattingTheme).where(FormattingTheme.id == theme_id)
        )
        if not theme_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Theme not found")
    
    # Update book with active theme
    book.formatting_theme_id = str(theme_id) if theme_id else None
    await session.commit()
    
    return {
        "success": True,
        "message": "Theme applied",
        "book_id": str(book_id),
        "theme_id": str(theme_id),
    }
