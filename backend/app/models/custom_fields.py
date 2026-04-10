"""Custom Fields Models (P2.6)"""

from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Column, String, Text, JSON, ForeignKey, DateTime, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.core.database import Base


class CustomFieldType(str, enum.Enum):
    """Types of custom fields"""
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    MULTISELECT = "multiselect"
    CHECKBOX = "checkbox"
    RICH_TEXT = "rich_text"


class CustomFieldEntity(str, enum.Enum):
    """Entities that can have custom fields"""
    PROJECT = "project"
    CHAPTER = "chapter"
    CHARACTER = "character"
    LOCATION = "location"
    OBJECT = "object"
    EVENT = "event"


class CustomField(Base):
    """Custom field definition for a project"""
    __tablename__ = "custom_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # project, chapter, character, location, etc.
    name = Column(String(255), nullable=False)
    description = Column(Text)
    field_type = Column(String(50), nullable=False)  # text, number, date, select, etc.
    required = Column(Boolean, default=False)
    default_value = Column(JSON)
    options = Column(JSON)  # For select/multiselect - list of valid options
    order_index = Column(String(255), default=255)  # For field ordering
    is_visible_in_list = Column(Boolean, default=True)  # Should show in list views
    is_filterable = Column(Boolean, default=True)
    metadata = Column(JSON)  # Extra settings (regex validation, min/max, etc.)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    book = relationship("Book", foreign_keys=[book_id])
    field_values = relationship("CustomFieldValue", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "book_id": str(self.book_id),
            "entity_type": self.entity_type,
            "name": self.name,
            "description": self.description,
            "field_type": self.field_type,
            "required": self.required,
            "default_value": self.default_value,
            "options": self.options,
            "order_index": self.order_index,
            "is_visible_in_list": self.is_visible_in_list,
            "is_filterable": self.is_filterable,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class CustomFieldValue(Base):
    """Stores values for custom fields"""
    __tablename__ = "custom_field_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    custom_field_id = Column(UUID(as_uuid=True), ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # project, chapter, character, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # ID of the actual entity
    value = Column(JSON, nullable=True)  # Can be any JSON-serializable value
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    custom_field = relationship("CustomField", foreign_keys=[custom_field_id])

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "custom_field_id": str(self.custom_field_id),
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id),
            "value": self.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
