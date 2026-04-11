"""API endpoints for classroom management."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import Classroom, ClassAssignment, ClassroomSubmission, ClassroomGrade, SubmissionFeedback
from app.models import ClassroomRole, AssignmentStatus, SubmissionStatus
from app.models.user import User
from app.core.auth import get_current_user
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/classrooms", tags=["classrooms"])


# ============================================================================
# Schemas
# ============================================================================


class ClassroomCreate(BaseModel):
    """Create new classroom."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    school_name: Optional[str] = None
    is_public: bool = False


class ClassroomUpdate(BaseModel):
    """Update classroom."""
    title: Optional[str] = None
    description: Optional[str] = None
    school_name: Optional[str] = None
    is_public: Optional[bool] = None


class ClassroomResponse(BaseModel):
    """Classroom response."""
    id: str
    owner_id: str
    title: str
    description: Optional[str]
    school_name: Optional[str]
    code: str
    is_public: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassAssignmentCreate(BaseModel):
    """Create assignment."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    publish_date: Optional[datetime] = None
    word_count_min: Optional[int] = None
    word_count_max: Optional[int] = None
    allow_peer_review: bool = True
    allow_student_upload: bool = True


class ClassAssignmentUpdate(BaseModel):
    """Update assignment."""
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    publish_date: Optional[datetime] = None
    status: Optional[AssignmentStatus] = None
    word_count_min: Optional[int] = None
    word_count_max: Optional[int] = None
    allow_peer_review: Optional[bool] = None
    allow_student_upload: Optional[bool] = None


class ClassAssignmentResponse(BaseModel):
    """Assignment response."""
    id: str
    classroom_id: str
    creator_id: str
    title: str
    description: Optional[str]
    instructions: Optional[str]
    status: AssignmentStatus
    due_date: Optional[datetime]
    publish_date: Optional[datetime]
    word_count_min: Optional[int]
    word_count_max: Optional[int]
    allow_peer_review: bool
    allow_student_upload: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ClassroomSubmissionCreate(BaseModel):
    """Submit assignment."""
    book_id: Optional[str] = None
    submission_text: Optional[str] = None


class ClassroomSubmissionResponse(BaseModel):
    """Submission response."""
    id: str
    assignment_id: str
    student_id: str
    book_id: Optional[str]
    submission_text: Optional[str]
    status: SubmissionStatus
    version: int
    submitted_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ClassroomGradeCreate(BaseModel):
    """Grade submission."""
    score: Optional[int] = Field(None, ge=0, le=100)
    letter_grade: Optional[str] = None
    feedback_text: Optional[str] = None
    rubric_json: Optional[str] = None


class ClassroomGradeResponse(BaseModel):
    """Grade response."""
    id: str
    submission_id: str
    grader_id: str
    score: Optional[int]
    letter_grade: Optional[str]
    feedback_text: Optional[str]
    graded_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Classroom Endpoints
# ============================================================================


@router.post("", response_model=ClassroomResponse)
async def create_classroom(
    classroom: ClassroomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create new classroom."""
    from sqlalchemy import insert
    
    new_classroom = Classroom(
        id=str(uuid.uuid4()),
        owner_id=str(current_user.id),
        title=classroom.title,
        description=classroom.description,
        school_name=classroom.school_name,
        is_public=classroom.is_public,
        code=str(uuid.uuid4())[:8].upper(),
    )
    
    db.add(new_classroom)
    await db.commit()
    await db.refresh(new_classroom)
    
    return new_classroom


@router.get("", response_model=List[ClassroomResponse])
async def list_classrooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """List classrooms user owns or is enrolled in."""
    from sqlalchemy import select, or_
    
    query = select(Classroom).where(
        or_(
            Classroom.owner_id == str(current_user.id),
            Classroom.students.any(id=current_user.id),
        )
    )
    
    result = await db.execute(query)
    classrooms = result.scalars().all()
    
    return classrooms


@router.get("/{classroom_id}", response_model=ClassroomResponse)
async def get_classroom(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get classroom details."""
    from sqlalchemy import select
    
    query = select(Classroom).where(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    return classroom


@router.put("/{classroom_id}", response_model=ClassroomResponse)
async def update_classroom(
    classroom_id: str,
    updates: ClassroomUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update classroom (owner only)."""
    from sqlalchemy import select
    
    query = select(Classroom).where(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    if classroom.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for field, value in updates.dict(exclude_unset=True).items():
        if value is not None:
            setattr(classroom, field, value)
    
    classroom.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(classroom)
    
    return classroom


@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete classroom (owner only)."""
    from sqlalchemy import select
    
    query = select(Classroom).where(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    if classroom.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(classroom)
    await db.commit()
    
    return {"success": True}


@router.post("/{classroom_id}/join")
async def join_classroom(
    classroom_id: str,
    code: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Join classroom with code (student)."""
    from sqlalchemy import select
    
    query = select(Classroom).where(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    if classroom.code != code:
        raise HTTPException(status_code=401, detail="Invalid classroom code")
    
    if current_user not in classroom.students:
        classroom.students.append(current_user)
        await db.commit()
    
    return {"success": True}


# ============================================================================
# Assignment Endpoints
# ============================================================================


@router.post("/{classroom_id}/assignments", response_model=ClassAssignmentResponse)
async def create_assignment(
    classroom_id: str,
    assignment: ClassAssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create assignment (teacher only)."""
    from sqlalchemy import select
    
    # Verify classroom exists and user owns it
    query = select(Classroom).where(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    if classroom.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_assignment = ClassAssignment(
        id=str(uuid.uuid4()),
        classroom_id=classroom_id,
        creator_id=str(current_user.id),
        title=assignment.title,
        description=assignment.description,
        instructions=assignment.instructions,
        due_date=assignment.due_date,
        publish_date=assignment.publish_date,
        word_count_min=assignment.word_count_min,
        word_count_max=assignment.word_count_max,
        allow_peer_review=assignment.allow_peer_review,
        allow_student_upload=assignment.allow_student_upload,
    )
    
    db.add(new_assignment)
    await db.commit()
    await db.refresh(new_assignment)
    
    return new_assignment


@router.get("/{classroom_id}/assignments", response_model=List[ClassAssignmentResponse])
async def list_assignments(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """List assignments in classroom."""
    from sqlalchemy import select
    
    query = select(ClassAssignment).where(ClassAssignment.classroom_id == classroom_id)
    result = await db.execute(query)
    assignments = result.scalars().all()
    
    return assignments


# ============================================================================
# Submission Endpoints
# ============================================================================


@router.post("/{classroom_id}/assignments/{assignment_id}/submit", response_model=ClassroomSubmissionResponse)
async def submit_assignment(
    classroom_id: str,
    assignment_id: str,
    submission: ClassroomSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Submit assignment."""
    from sqlalchemy import select
    
    # Verify assignment exists
    query = select(ClassAssignment).where(ClassAssignment.id == assignment_id)
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check for existing submission
    query = select(ClassroomSubmission).where(
        (ClassroomSubmission.assignment_id == assignment_id)
        & (ClassroomSubmission.student_id == str(current_user.id))
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing submission
        existing.version += 1
        existing.status = SubmissionStatus.IN_PROGRESS
        existing.book_id = submission.book_id
        existing.submission_text = submission.submission_text
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    
    # Create new submission
    new_submission = ClassroomSubmission(
        id=str(uuid.uuid4()),
        assignment_id=assignment_id,
        student_id=str(current_user.id),
        book_id=submission.book_id,
        submission_text=submission.submission_text,
        status=SubmissionStatus.IN_PROGRESS,
    )
    
    db.add(new_submission)
    await db.commit()
    await db.refresh(new_submission)
    
    return new_submission


@router.get("/{classroom_id}/assignments/{assignment_id}/submissions", response_model=List[ClassroomSubmissionResponse])
async def list_submissions(
    classroom_id: str,
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """List submissions for assignment (teacher only)."""
    from sqlalchemy import select
    
    query = select(ClassroomSubmission).where(ClassroomSubmission.assignment_id == assignment_id)
    result = await db.execute(query)
    submissions = result.scalars().all()
    
    return submissions


# ============================================================================
# Grading Endpoints
# ============================================================================


@router.post("/{classroom_id}/submissions/{submission_id}/grade", response_model=ClassroomGradeResponse)
async def grade_submission(
    classroom_id: str,
    submission_id: str,
    grade: ClassroomGradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Grade submission (teacher only)."""
    from sqlalchemy import select
    
    # Verify submission exists
    query = select(ClassroomSubmission).where(ClassroomSubmission.id == submission_id)
    result = await db.execute(query)
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check for existing grade
    query = select(ClassroomGrade).where(ClassroomGrade.submission_id == submission_id)
    result = await db.execute(query)
    existing_grade = result.scalar_one_or_none()
    
    if existing_grade:
        existing_grade.score = grade.score
        existing_grade.letter_grade = grade.letter_grade
        existing_grade.feedback_text = grade.feedback_text
        existing_grade.rubric_json = grade.rubric_json
        existing_grade.graded_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing_grade)
        submission.status = SubmissionStatus.GRADED
        await db.commit()
        return existing_grade
    
    # Create new grade
    new_grade = ClassroomGrade(
        id=str(uuid.uuid4()),
        classroom_id=classroom_id,
        submission_id=submission_id,
        grader_id=str(current_user.id),
        score=grade.score,
        letter_grade=grade.letter_grade,
        feedback_text=grade.feedback_text,
        rubric_json=grade.rubric_json,
    )
    
    db.add(new_grade)
    submission.status = SubmissionStatus.GRADED
    await db.commit()
    await db.refresh(new_grade)
    
    return new_grade
