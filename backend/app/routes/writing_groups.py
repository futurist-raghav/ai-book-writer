"""
Writing Groups - Author collaboration and community
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models import User
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ==================== Pydantic Models ====================

class WritingGroupCreate(BaseModel):
    name: str
    description: str
    genre: str
    max_members: int = 50
    is_public: bool = True

class WritingGroupResponse(BaseModel):
    group_id: str
    name: str
    description: str
    genre: str
    creator_id: str
    member_count: int
    is_public: bool
    created_at: datetime

class WritingGroupMemberResponse(BaseModel):
    user_id: str
    username: str
    role: str  # creator, moderator, member
    joined_at: datetime
    post_count: int

class GroupPostResponse(BaseModel):
    post_id: str
    author_id: str
    author_username: str
    group_id: str
    title: str
    content: str
    excerpt: str
    word_count: int
    likes: int
    comments: int
    created_at: datetime

# ==================== Writing Groups ====================

@router.post("/writing-groups")
async def create_writing_group(
    group_data: WritingGroupCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new writing group"""
    return {
        "group_id": f"group_{current_user.id}_{datetime.utcnow().timestamp()}",
        "name": group_data.name,
        "description": group_data.description,
        "genre": group_data.genre,
        "creator_id": current_user.id,
        "creator_username": current_user.username,
        "member_count": 1,
        "is_public": group_data.is_public,
        "max_members": group_data.max_members,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.get("/writing-groups")
async def list_writing_groups(
    genre: str = Query(None),
    search: str = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
):
    """List all public writing groups"""
    # Mock data
    return {
        "groups": [
            {
                "group_id": f"group_{i}",
                "name": f"Genre Writers Group #{i}",
                "description": f"A community for writers in this genre",
                "genre": genre or "Fiction",
                "member_count": 15 + i,
                "is_public": True,
                "created_at": datetime.utcnow().isoformat(),
            }
            for i in range(limit)
        ],
        "total": limit,
    }


@router.get("/writing-groups/{group_id}")
async def get_writing_group(group_id: str):
    """Get writing group details"""
    return {
        "group_id": group_id,
        "name": "Science Fiction Writers",
        "description": "For authors writing in sci-fi genres",
        "genre": "Science Fiction",
        "creator_id": "user_123",
        "member_count": 42,
        "is_public": True,
        "created_at": datetime.utcnow().isoformat(),
        "recent_posts": 15,
        "rules": [
            "Be respectful of all members",
            "Constructive feedback only",
            "Share your work and help others",
        ],
    }


@router.post("/writing-groups/{group_id}/join")
async def join_writing_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
):
    """Join a writing group"""
    return {
        "status": "success",
        "group_id": group_id,
        "user_id": current_user.id,
        "role": "member",
        "joined_at": datetime.utcnow().isoformat(),
    }


@router.post("/writing-groups/{group_id}/leave")
async def leave_writing_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
):
    """Leave a writing group"""
    return {
        "status": "success",
        "message": f"You have left the group",
        "left_at": datetime.utcnow().isoformat(),
    }


@router.get("/writing-groups/{group_id}/members")
async def get_group_members(
    group_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
):
    """Get writing group members"""
    return {
        "group_id": group_id,
        "members": [
            {
                "user_id": f"user_{i}",
                "username": f"author_{i}",
                "role": "creator" if i == 0 else "moderator" if i == 1 else "member",
                "joined_at": datetime.utcnow().isoformat(),
                "post_count": (10 - i) if i < 10 else 0,
            }
            for i in range(limit)
        ],
        "total": limit,
    }


# ==================== Group Posts ====================

@router.post("/writing-groups/{group_id}/posts")
async def create_group_post(
    group_id: str,
    title: str,
    content: str,
    excerpt: str = None,
    current_user: User = Depends(get_current_user),
):
    """Post writing to group for feedback"""
    word_count = len(content.split())
    return {
        "post_id": f"post_{current_user.id}_{datetime.utcnow().timestamp()}",
        "group_id": group_id,
        "author_id": current_user.id,
        "author_username": current_user.username,
        "title": title,
        "content": content[:500],  # Preview
        "excerpt": excerpt or content[:150],
        "word_count": word_count,
        "likes": 0,
        "comments": 0,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.get("/writing-groups/{group_id}/posts")
async def list_group_posts(
    group_id: str,
    sort_by: str = Query("recent"),  # recent, popular
    limit: int = Query(20, le=100),
    offset: int = Query(0),
):
    """List posts in writing group"""
    return {
        "group_id": group_id,
        "posts": [
            {
                "post_id": f"post_{i}",
                "author_id": f"user_{i}",
                "author_username": f"author_{i}",
                "title": f"Chapter Draft #{i}",
                "excerpt": "A wonderful story excerpt...",
                "word_count": 2000 + (i * 100),
                "likes": 10 - i if i < 10 else 0,
                "comments": 5 - (i // 2) if i < 10 else 0,
                "created_at": datetime.utcnow().isoformat(),
            }
            for i in range(limit)
        ],
        "total": limit,
    }


@router.post("/writing-groups/{group_id}/posts/{post_id}/like")
async def like_group_post(
    group_id: str,
    post_id: str,
    current_user: User = Depends(get_current_user),
):
    """Like a group post"""
    return {
        "status": "success",
        "post_id": post_id,
        "liked": True,
        "new_like_count": 11,
    }


@router.post("/writing-groups/{group_id}/posts/{post_id}/comment")
async def comment_on_post(
    group_id: str,
    post_id: str,
    content: str,
    current_user: User = Depends(get_current_user),
):
    """Comment on a group post"""
    return {
        "comment_id": f"comment_{current_user.id}_{datetime.utcnow().timestamp()}",
        "post_id": post_id,
        "author_id": current_user.id,
        "author_username": current_user.username,
        "content": content,
        "created_at": datetime.utcnow().isoformat(),
    }


# ==================== Moderation ====================

@router.post("/writing-groups/{group_id}/members/{user_id}/promote")
async def promote_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    """Promote member to moderator (creator only)"""
    return {
        "status": "success",
        "user_id": user_id,
        "role": "moderator",
        "promoted_at": datetime.utcnow().isoformat(),
    }


@router.post("/writing-groups/{group_id}/members/{user_id}/remove")
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove member from group (moderator+)"""
    return {
        "status": "success",
        "user_id": user_id,
        "removed_at": datetime.utcnow().isoformat(),
    }


@router.delete("/writing-groups/{group_id}/posts/{post_id}")
async def delete_post(
    group_id: str,
    post_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a post (author or moderator)"""
    return {
        "status": "success",
        "post_id": post_id,
        "deleted_at": datetime.utcnow().isoformat(),
    }


# Helper
async def get_current_user():
    return None
