"""Author community and networking services."""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.author_community import (
    AuthorProfile,
    BetaReaderProfile,
    BetaReaderMatch,
    WritingGroup,
    WritingGroupMember,
    AuthorMessage,
    PublicAuthorPage,
    AuthorCollaboration,
)
from app.schemas.author_community import (
    BetaReaderProfileCreate,
    BetaReaderMatchCreate,
    WritingGroupCreate,
    AuthorMessageCreate,
    AuthorCollaborationCreate,
)


class AuthorCommunityService:
    """Service for author community operations."""
    
    @staticmethod
    def get_or_create_profile(db: Session, user_id: str) -> AuthorProfile:
        """Get or create author profile."""
        profile = db.query(AuthorProfile).filter_by(user_id=user_id).first()
        if not profile:
            profile = AuthorProfile(
                id=str(uuid4()),
                user_id=user_id,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return profile
    
    @staticmethod
    def update_profile(
        db: Session,
        user_id: str,
        updates: dict,
    ) -> Optional[AuthorProfile]:
        """Update author profile."""
        profile = db.query(AuthorProfile).filter_by(user_id=user_id).first()
        if not profile:
            return None
        
        for key, value in updates.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        return profile
    
    @staticmethod
    def get_or_create_page(db: Session, user_id: str) -> PublicAuthorPage:
        """Get or create public author page."""
        page = db.query(PublicAuthorPage).filter_by(user_id=user_id).first()
        if not page:
            page = PublicAuthorPage(
                id=str(uuid4()),
                user_id=user_id,
            )
            db.add(page)
            db.commit()
            db.refresh(page)
        return page


class BetaReaderService:
    """Service for beta reader operations."""
    
    @staticmethod
    def create_profile(
        db: Session,
        user_id: str,
        profile_data: BetaReaderProfileCreate,
    ) -> BetaReaderProfile:
        """Create beta reader profile."""
        profile = BetaReaderProfile(
            id=str(uuid4()),
            user_id=user_id,
            is_beta_reader=1,
            experience_level=profile_data.experience_level,
            preferred_genres=profile_data.preferred_genres,
            max_word_count=profile_data.max_word_count,
            max_concurrent_books=profile_data.max_concurrent_books,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile
    
    @staticmethod
    def find_matches(
        db: Session,
        book_id: str,
        genre: str,
        word_count: int,
    ) -> List[BetaReaderProfile]:
        """Find beta readers matching book profile."""
        # TODO: Implement ML-based matching algorithm
        # For now, simple heuristic match
        matches = db.query(BetaReaderProfile).filter(
            BetaReaderProfile.is_beta_reader == 1,
            BetaReaderProfile.preferred_genres.like(f"%{genre}%"),
            BetaReaderProfile.max_word_count >= word_count,
            BetaReaderProfile.current_requests < BetaReaderProfile.max_concurrent_books,
        ).all()
        return matches
    
    @staticmethod
    def request_match(
        db: Session,
        match_data: BetaReaderMatchCreate,
    ) -> BetaReaderMatch:
        """Request beta reader for book."""
        match = BetaReaderMatch(
            id=str(uuid4()),
            book_id=match_data.book_id,
            beta_reader_id=match_data.beta_reader_id,
            author_id=None,  # Will be set by controller
            compatibility_score=0.75,  # Placeholder
        )
        db.add(match)
        db.commit()
        db.refresh(match)
        return match
    
    @staticmethod
    def update_match_status(
        db: Session,
        match_id: str,
        status: str,
    ) -> Optional[BetaReaderMatch]:
        """Update match status."""
        match = db.query(BetaReaderMatch).filter_by(id=match_id).first()
        if not match:
            return None
        
        match.status = status
        if status == "accepted":
            match.accepted_at = datetime.utcnow()
        elif status == "completed":
            match.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(match)
        return match


class WritingGroupService:
    """Service for writing group operations."""
    
    @staticmethod
    def create_group(
        db: Session,
        creator_id: str,
        group_data: WritingGroupCreate,
    ) -> WritingGroup:
        """Create writing group."""
        # Generate slug from name
        slug = group_data.name.lower().replace(" ", "-")[:100]
        
        group = WritingGroup(
            id=str(uuid4()),
            creator_id=creator_id,
            name=group_data.name,
            description=group_data.description,
            slug=slug,
            visibility=group_data.visibility,
            focus_genres=group_data.focus_genres,
            writing_stage=group_data.writing_stage,
        )
        db.add(group)
        
        # Add creator as member
        member = WritingGroupMember(
            id=str(uuid4()),
            group_id=group.id,
            user_id=creator_id,
            role="creator",
        )
        db.add(member)
        db.commit()
        db.refresh(group)
        return group
    
    @staticmethod
    def join_group(
        db: Session,
        group_id: str,
        user_id: str,
    ) -> Optional[WritingGroupMember]:
        """Join writing group."""
        # Check if already member
        existing = db.query(WritingGroupMember).filter_by(
            group_id=group_id,
            user_id=user_id,
        ).first()
        if existing and existing.status == "active":
            return existing
        
        member = WritingGroupMember(
            id=str(uuid4()),
            group_id=group_id,
            user_id=user_id,
            role="member",
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member
    
    @staticmethod
    def search_groups(
        db: Session,
        genre: Optional[str] = None,
        writing_stage: Optional[str] = None,
        limit: int = 20,
    ) -> List[WritingGroup]:
        """Search writing groups."""
        query = db.query(WritingGroup).filter_by(visibility="public")
        
        if genre:
            query = query.filter(WritingGroup.focus_genres.like(f"%{genre}%"))
        
        if writing_stage:
            query = query.filter(WritingGroup.writing_stage.like(f"%{writing_stage}%"))
        
        return query.limit(limit).all()


class AuthorMessagingService:
    """Service for author messaging."""
    
    @staticmethod
    def send_message(
        db: Session,
        sender_id: str,
        message_data: AuthorMessageCreate,
    ) -> AuthorMessage:
        """Send message to another author."""
        message = AuthorMessage(
            id=str(uuid4()),
            sender_id=sender_id,
            recipient_id=message_data.recipient_id,
            subject=message_data.subject,
            content=message_data.content,
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
    
    @staticmethod
    def get_conversation(
        db: Session,
        user_id: str,
        other_user_id: str,
    ) -> List[AuthorMessage]:
        """Get conversation between two authors."""
        messages = db.query(AuthorMessage).filter(
            (
                (AuthorMessage.sender_id == user_id) &
                (AuthorMessage.recipient_id == other_user_id)
            ) |
            (
                (AuthorMessage.sender_id == other_user_id) &
                (AuthorMessage.recipient_id == user_id)
            )
        ).order_by(AuthorMessage.created_at).all()
        return messages
    
    @staticmethod
    def mark_as_read(db: Session, message_id: str) -> Optional[AuthorMessage]:
        """Mark message as read."""
        message = db.query(AuthorMessage).filter_by(id=message_id).first()
        if not message:
            return None
        
        message.is_read = 1
        message.read_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
        return message


class AuthorCollaborationService:
    """Service for author collaboration requests."""
    
    @staticmethod
    def request_collaboration(
        db: Session,
        initiator_id: str,
        collab_data: AuthorCollaborationCreate,
    ) -> AuthorCollaboration:
        """Request collaboration with another author."""
        collab = AuthorCollaboration(
            id=str(uuid4()),
            initiator_id=initiator_id,
            collaborator_id=collab_data.collaborator_id,
            book_id=collab_data.book_id,
            type=collab_data.type,
            message=collab_data.message,
        )
        db.add(collab)
        db.commit()
        db.refresh(collab)
        return collab
    
    @staticmethod
    def update_status(
        db: Session,
        collab_id: str,
        status: str,
    ) -> Optional[AuthorCollaboration]:
        """Update collaboration status."""
        collab = db.query(AuthorCollaboration).filter_by(id=collab_id).first()
        if not collab:
            return None
        
        collab.status = status
        if status == "accepted":
            collab.accepted_at = datetime.utcnow()
        elif status == "completed":
            collab.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(collab)
        return collab
