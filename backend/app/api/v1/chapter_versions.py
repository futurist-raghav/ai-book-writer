"""
Chapter Versions API Routes

Handles chapter version history, snapshots, and recovery.
"""

import difflib
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep
from app.models.chapter import Chapter
from app.models.chapter_version import ChapterVersion
from app.schemas.chapter_version import (
    ChapterVersionCreate,
    ChapterVersionDiffResponse,
    ChapterVersionListResponse,
    ChapterVersionResponse,
    ChapterVersionUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter()


@router.post(
    "/chapters/{chapter_id}/versions",
    response_model=ChapterVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chapter_version(
    chapter_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    request: ChapterVersionCreate,
) -> ChapterVersionResponse:
    """Create a new version snapshot of a chapter."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Create version snapshot
    version = ChapterVersion(
        chapter_id=chapter_id,
        user_id=user_id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        compiled_content=chapter.compiled_content,
        summary=chapter.summary,
        word_count=chapter.word_count,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        version_name=request.version_name,
        change_description=request.change_description,
        is_auto_snapshot=request.is_auto_snapshot,
    )

    session.add(version)
    await session.commit()
    await session.refresh(version)

    return ChapterVersionResponse.model_validate(version)


@router.get(
    "/chapters/{chapter_id}/versions",
    response_model=PaginatedResponse[ChapterVersionListResponse],
)
async def list_chapter_versions(
    chapter_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PaginatedResponse[ChapterVersionListResponse]:
    """List all versions of a chapter with pagination."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get total count
    count_result = await session.execute(
        select(chapter.versions).where(ChapterVersion.chapter_id == chapter_id)
    )
    total_count = len(count_result.scalars().all())

    # Get paginated versions
    skip = (page - 1) * page_size
    result = await session.execute(
        select(ChapterVersion)
        .where(ChapterVersion.chapter_id == chapter_id)
        .order_by(desc(ChapterVersion.created_at))
        .offset(skip)
        .limit(page_size)
    )
    versions = result.scalars().all()

    items = [ChapterVersionListResponse.model_validate(v) for v in versions]

    return PaginatedResponse(
        items=items,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=(total_count + page_size - 1) // page_size,
    )


@router.get(
    "/chapters/{chapter_id}/versions/{version_id}",
    response_model=ChapterVersionResponse,
)
async def get_chapter_version(
    chapter_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ChapterVersionResponse:
    """Get a specific version of a chapter."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get the version
    result = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    return ChapterVersionResponse.model_validate(version)


@router.patch(
    "/chapters/{chapter_id}/versions/{version_id}",
    response_model=ChapterVersionResponse,
)
async def update_chapter_version(
    chapter_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
    request: ChapterVersionUpdate,
) -> ChapterVersionResponse:
    """Update metadata of a chapter version (name, description)."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get the version
    result = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Update metadata
    if request.version_name is not None:
        version.version_name = request.version_name
    if request.change_description is not None:
        version.change_description = request.change_description

    await session.commit()
    await session.refresh(version)

    return ChapterVersionResponse.model_validate(version)


@router.delete(
    "/chapters/{chapter_id}/versions/{version_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_chapter_version(
    chapter_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> None:
    """Delete a specific version snapshot."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get the version
    result = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    await session.delete(version)
    await session.commit()


@router.post(
    "/chapters/{chapter_id}/revert-to/{version_id}",
    response_model=ChapterVersionResponse,
)
async def revert_to_version(
    chapter_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ChapterVersionResponse:
    """Revert chapter to a previous version."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get the version to revert to
    result = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    source_version = result.scalar_one_or_none()
    if not source_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Create a backup snapshot of current state before reverting
    backup = ChapterVersion(
        chapter_id=chapter_id,
        user_id=user_id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        compiled_content=chapter.compiled_content,
        summary=chapter.summary,
        word_count=chapter.word_count,
        chapter_number=chapter.chapter_number,
        order_index=chapter.order_index,
        chapter_type=chapter.chapter_type,
        workflow_status=chapter.workflow_status,
        version_name=f"Backup before revert to {source_version.version_name or 'version'}",
        change_description=f"Auto-backup before reverting to version {source_version.id}",
        is_auto_snapshot=True,
    )
    session.add(backup)

    # Revert chapter to source version
    chapter.title = source_version.title
    chapter.subtitle = source_version.subtitle
    chapter.compiled_content = source_version.compiled_content
    chapter.summary = source_version.summary
    chapter.chapter_type = source_version.chapter_type
    chapter.workflow_status = source_version.workflow_status
    chapter.word_count_target = None  # Don't restore target, that's a user setting

    await session.commit()
    await session.refresh(backup)

    return ChapterVersionResponse.model_validate(backup)


@router.get(
    "/chapters/{chapter_id}/versions/{from_version_id}/diff/{to_version_id}",
    response_model=ChapterVersionDiffResponse,
)
async def get_version_diff(
    chapter_id: uuid.UUID,
    from_version_id: uuid.UUID,
    to_version_id: uuid.UUID,
    session: AsyncSessionDep,
    user_id: CurrentUserIdDep,
) -> ChapterVersionDiffResponse:
    """Get diff between two versions of a chapter."""
    # Verify chapter exists and user has access
    result = await session.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.user_id == user_id)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Get both versions
    result_from = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == from_version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    from_version = result_from.scalar_one_or_none()
    if not from_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="From version not found"
        )

    result_to = await session.execute(
        select(ChapterVersion).where(
            ChapterVersion.id == to_version_id,
            ChapterVersion.chapter_id == chapter_id,
        )
    )
    to_version = result_to.scalar_one_or_none()
    if not to_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="To version not found")

    # Generate unified diff
    from_lines = (from_version.compiled_content or "").splitlines(keepends=True)
    to_lines = (to_version.compiled_content or "").splitlines(keepends=True)
    diff_lines = difflib.unified_diff(from_lines, to_lines, lineterm="")
    content_diff = "\n".join(diff_lines)

    return ChapterVersionDiffResponse(
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        title_changed=from_version.title != to_version.title,
        summary_changed=from_version.summary != to_version.summary,
        content_diff=content_diff,
        word_count_before=from_version.word_count,
        word_count_after=to_version.word_count,
        word_count_change=(to_version.word_count or 0) - (from_version.word_count or 0),
    )
