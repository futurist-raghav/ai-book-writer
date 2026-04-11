"""
Front/Back Matter Configuration Endpoints

Manage title page, TOC, dedication, about author, etc.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AsyncSessionDep, get_current_user
from app.models.book import Book
from app.models.matter_config import MatterConfig
from app.models.user import User
from app.schemas.matter_config import (
    MatterConfigUpdate,
    MatterConfigResponse,
)


router = APIRouter(prefix="/books/{book_id}", tags=["Front/Back Matter"])


@router.get("/matter-config", response_model=MatterConfigResponse)
async def get_matter_config(
    book_id: UUID,
    session: AsyncSession = Depends(AsyncSessionDep),
    current_user: User = Depends(get_current_user),
):
    """
    Get front/back matter configuration for a book.
    Creates default config if it doesn't exist.
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    if not book_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get or create matter config
    config_result = await session.execute(
        select(MatterConfig).where(MatterConfig.book_id == book_id)
    )
    config = config_result.scalar_one_or_none()
    
    if not config:
        # Create default config
        config = MatterConfig(
            book_id=book_id,
            include_title_page=True,
            include_copyright_page=True,
            include_toc=True,
        )
        session.add(config)
        await session.commit()
        await session.refresh(config)
    
    return MatterConfigResponse.from_attributes(config)


@router.patch("/matter-config", response_model=MatterConfigResponse)
async def update_matter_config(
    book_id: UUID,
    config_update: MatterConfigUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Update front/back matter configuration.
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    if not book_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get or create matter config
    config_result = await session.execute(
        select(MatterConfig).where(MatterConfig.book_id == book_id)
    )
    config = config_result.scalar_one_or_none()
    
    if not config:
        config = MatterConfig(book_id=book_id)
        session.add(config)
    
    # Update fields
    update_data = config_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    
    await session.commit()
    await session.refresh(config)
    
    return MatterConfigResponse.from_attributes(config)


@router.post("/matter-config/reset")
async def reset_matter_config(
    book_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(AsyncSessionDep),
):
    """
    Reset matter configuration to defaults.
    """
    # Verify book exists
    book_result = await session.execute(select(Book).where(Book.id == book_id))
    if not book_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Delete existing config
    config_result = await session.execute(
        select(MatterConfig).where(MatterConfig.book_id == book_id)
    )
    config = config_result.scalar_one_or_none()
    
    if config:
        await session.delete(config)
        await session.commit()
    
    # Return default config
    config = MatterConfig(
        book_id=book_id,
        include_title_page=True,
        include_copyright_page=True,
        include_toc=True,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)
    
    return {
        "success": True,
        "message": "Matter configuration reset to defaults",
        "config": MatterConfigResponse.from_attributes(config),
    }
