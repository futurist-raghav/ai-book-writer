"""Custom Fields Schemas (P2.6)"""

from typing import Any, List, Optional
from pydantic import BaseModel


class CustomFieldCreateRequest(BaseModel):
    """Request to create a custom field"""
    entity_type: str  # project, chapter, character, location, object, event
    name: str
    description: Optional[str] = None
    field_type: str  # text, number, date, select, multiselect, checkbox, rich_text
    required: bool = False
    default_value: Optional[Any] = None
    options: Optional[List[str]] = None  # For select/multiselect
    order_index: str = "255"
    is_visible_in_list: bool = True
    is_filterable: bool = True
    metadata: Optional[dict] = None  # Extra settings


class CustomFieldUpdateRequest(BaseModel):
    """Request to update a custom field"""
    name: Optional[str] = None
    description: Optional[str] = None
    required: Optional[bool] = None
    default_value: Optional[Any] = None
    options: Optional[List[str]] = None
    order_index: Optional[str] = None
    is_visible_in_list: Optional[bool] = None
    is_filterable: Optional[bool] = None
    metadata: Optional[dict] = None


class CustomFieldResponse(BaseModel):
    """Response with custom field data"""
    id: str
    book_id: str
    entity_type: str
    name: str
    description: Optional[str]
    field_type: str
    required: bool
    default_value: Optional[Any]
    options: Optional[List[str]]
    order_index: str
    is_visible_in_list: bool
    is_filterable: bool
    metadata: Optional[dict]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class CustomFieldValueSetRequest(BaseModel):
    """Request to set a custom field value"""
    value: Optional[Any] = None


class CustomFieldValueResponse(BaseModel):
    """Response with custom field value"""
    id: str
    custom_field_id: str
    entity_type: str
    entity_id: str
    value: Optional[Any]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class EntityWithCustomFieldsResponse(BaseModel):
    """Entity response with custom field values"""
    id: str
    name: str
    custom_fields: dict  # { field_name: value }
