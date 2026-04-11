from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PublicShareCreate(BaseModel):
    allow_comments: bool = True
    allow_ratings: bool = True

class PublicShareUpdate(BaseModel):
    is_public: Optional[bool] = None
    allow_comments: Optional[bool] = None
    allow_ratings: Optional[bool] = None

class PublicShareResponse(BaseModel):
    id: str
    book_id: str
    share_url: str
    is_public: bool
    allow_comments: bool
    allow_ratings: bool
    created_at: datetime

    class Config:
        from_attributes = True
