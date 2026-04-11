"""Classroom and institution models for collaborative learning."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer, Boolean, Table, Text
from sqlalchemy.orm import relationship
import enum
from app.db import Base

# Association table for classroom students
classroom_students = Table(
    'classroom_students',
    Base.metadata,
    Column('classroom_id', String(36), ForeignKey('classrooms.id'), primary_key=True),
    Column('user_id', String(36), ForeignKey('users.id'), primary_key=True),
)

# Association table for assignment submissions
assignment_submissions = Table(
    'assignment_submissions',
    Base.metadata,
    Column('assignment_id', String(36), ForeignKey('class_assignments.id'), primary_key=True),
    Column('student_id', String(36), ForeignKey('users.id'), primary_key=True),
)


class ClassroomRole(str, enum.Enum):
    """Classroom member roles."""
    TEACHER = 'teacher'
    STUDENT = 'student'
    ASSISTANT = 'assistant'


class AssignmentStatus(str, enum.Enum):
    """Assignment lifecycle status."""
    DRAFT = 'draft'
    ACTIVE = 'active'
    CLOSED = 'closed'
    ARCHIVED = 'archived'


class SubmissionStatus(str, enum.Enum):
    """Student submission status."""
    NOT_STARTED = 'not_started'
    IN_PROGRESS = 'in_progress'
    SUBMITTED = 'submitted'
    GRADED = 'graded'


class Classroom(Base):
    """Classroom for group writing instruction and collaboration."""
    
    __tablename__ = "classrooms"
    
    id = Column(String(36), primary_key=True, index=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    school_name = Column(String(255))
    
    # Access control
    code = Column(String(50), unique=True, index=True)  # Join code for students
    is_public = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = Column(DateTime)
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_id], back_populates="classrooms_owned")
    students = relationship("User", secondary=classroom_students, back_populates="classrooms_enrolled")
    assignments = relationship("ClassAssignment", back_populates="classroom", cascade="all, delete-orphan")
    grades = relationship("ClassroomGrade", back_populates="classroom", cascade="all, delete-orphan")


class ClassAssignment(Base):
    """Writing assignment for classroom."""
    
    __tablename__ = "class_assignments"
    
    id = Column(String(36), primary_key=True, index=True)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False, index=True)
    creator_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Assignment details
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    instructions = Column(Text)
    
    # Status and timing
    status = Column(Enum(AssignmentStatus), default=AssignmentStatus.DRAFT)
    due_date = Column(DateTime)
    publish_date = Column(DateTime)
    
    # Requirements
    word_count_min = Column(Integer)  # Minimum word count
    word_count_max = Column(Integer)  # Maximum word count
    allow_peer_review = Column(Boolean, default=True)
    allow_student_upload = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    classroom = relationship("Classroom", back_populates="assignments")
    creator = relationship("User", foreign_keys=[creator_id])
    submissions = relationship("ClassroomSubmission", back_populates="assignment", cascade="all, delete-orphan")


class ClassroomSubmission(Base):
    """Student submission for an assignment."""
    
    __tablename__ = "classroom_submissions"
    
    id = Column(String(36), primary_key=True, index=True)
    assignment_id = Column(String(36), ForeignKey("class_assignments.id"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Submission content
    book_id = Column(String(36), ForeignKey("books.id"))  # Linked book project
    submission_text = Column(Text)  # Alternative: direct text submission
    
    # Status and versioning
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.NOT_STARTED)
    submitted_at = Column(DateTime)  # When student marked as submitted
    version = Column(Integer, default=1)  # Revision count
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assignment = relationship("ClassAssignment", back_populates="submissions")
    student = relationship("User", foreign_keys=[student_id])
    book = relationship("Book", foreign_keys=[book_id])
    feedback = relationship("SubmissionFeedback", back_populates="submission", cascade="all, delete-orphan")
    grade = relationship("ClassroomGrade", back_populates="submission", uselist=False)


class ClassroomGrade(Base):
    """Grade for student work in classroom."""
    
    __tablename__ = "classroom_grades"
    
    id = Column(String(36), primary_key=True, index=True)
    classroom_id = Column(String(36), ForeignKey("classrooms.id"), nullable=False, index=True)
    submission_id = Column(String(36), ForeignKey("classroom_submissions.id"), nullable=False, index=True)
    grader_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Grading
    score = Column(Integer)  # 0-100
    letter_grade = Column(String(2))  # A, B, C, etc.
    rubric_json = Column(Text)  # JSON of rubric scores
    
    # Feedback
    feedback_text = Column(Text)
    graded_at = Column(DateTime, default=datetime.utcnow)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    classroom = relationship("Classroom", back_populates="grades")
    submission = relationship("ClassroomSubmission", back_populates="grade")
    grader = relationship("User", foreign_keys=[grader_id])


class SubmissionFeedback(Base):
    """Comment/feedback on student submission."""
    
    __tablename__ = "submission_feedback"
    
    id = Column(String(36), primary_key=True, index=True)
    submission_id = Column(String(36), ForeignKey("classroom_submissions.id"), nullable=False, index=True)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Feedback content
    content = Column(Text, nullable=False)
    feedback_type = Column(String(50))  # 'general', 'grammar', 'structure', 'style', etc.
    
    # Location in text
    line_number = Column(Integer)  # Optional: specific line reference
    
    # Metadata
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    submission = relationship("ClassroomSubmission", back_populates="feedback")
    author = relationship("User", foreign_keys=[author_id])
