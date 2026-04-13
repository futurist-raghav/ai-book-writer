"""Custom Fields API Router (P2.6)"""

from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.custom_fields import CustomField, CustomFieldValue
from app.models.book import Book
from app.schemas.custom_fields import (
    CustomFieldCreateRequest,
    CustomFieldUpdateRequest,
    CustomFieldResponse,
    CustomFieldValueSetRequest,
    CustomFieldValueResponse,
)
from app.core.dependencies import get_current_user
from app.models.user import User


router = APIRouter(prefix="/books", tags=["Custom Fields"])


@router.get("/{book_id}/custom-fields", response_model=List[CustomFieldResponse])
async def list_custom_fields(
    book_id: UUID,
    entity_type: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List custom fields for a book, optionally filtered by entity type"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    query = db.query(CustomField).filter(CustomField.book_id == book_id)
    
    if entity_type:
        query = query.filter(CustomField.entity_type == entity_type)
    
    fields = query.order_by(CustomField.order_index, CustomField.created_at).all()
    
    return [f.to_dict() for f in fields]


@router.get("/{book_id}/custom-fields/{field_id}", response_model=CustomFieldResponse)
async def get_custom_field(
    book_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific custom field"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.book_id == book_id,
    ).first()
    
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found")
    
    return field.to_dict()


@router.post("/{book_id}/custom-fields", response_model=CustomFieldResponse)
async def create_custom_field(
    book_id: UUID,
    request: CustomFieldCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new custom field"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    field = CustomField(
        book_id=book_id,
        entity_type=request.entity_type,
        name=request.name,
        description=request.description,
        field_type=request.field_type,
        required=request.required,
        default_value=request.default_value,
        options=request.options,
        order_index=request.order_index,
        is_visible_in_list=request.is_visible_in_list,
        is_filterable=request.is_filterable,
        metadata=request.metadata,
    )
    
    db.add(field)
    db.commit()
    db.refresh(field)
    
    return field.to_dict()


@router.patch("/{book_id}/custom-fields/{field_id}", response_model=CustomFieldResponse)
async def update_custom_field(
    book_id: UUID,
    field_id: UUID,
    request: CustomFieldUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a custom field"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.book_id == book_id,
    ).first()
    
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found")
    
    # Update field attributes
    if request.name is not None:
        field.name = request.name
    if request.description is not None:
        field.description = request.description
    if request.required is not None:
        field.required = request.required
    if request.default_value is not None:
        field.default_value = request.default_value
    if request.options is not None:
        field.options = request.options
    if request.order_index is not None:
        field.order_index = request.order_index
    if request.is_visible_in_list is not None:
        field.is_visible_in_list = request.is_visible_in_list
    if request.is_filterable is not None:
        field.is_filterable = request.is_filterable
    if request.metadata is not None:
        field.metadata = request.metadata
    
    db.commit()
    db.refresh(field)
    
    return field.to_dict()


@router.delete("/{book_id}/custom-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field(
    book_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a custom field and all its values"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.book_id == book_id,
    ).first()
    
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found")
    
    db.delete(field)
    db.commit()


@router.get("/{book_id}/entities/{entity_type}/{entity_id}/custom-field-values", response_model=dict)
async def get_entity_custom_field_values(
    book_id: UUID,
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all custom field values for an entity"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    values = db.query(CustomFieldValue).filter(
        CustomFieldValue.custom_field_id.in_(
            db.query(CustomField.id).filter(CustomField.book_id == book_id)
        ),
        CustomFieldValue.entity_type == entity_type,
        CustomFieldValue.entity_id == entity_id,
    ).all()
    
    # Build response dict { field_name: value }
    result = {}
    for value in values:
        field = value.custom_field
        result[field.name] = {
            "field_id": str(value.custom_field_id),
            "value": value.value,
            "field_type": field.field_type,
        }
    
    return result


@router.post("/{book_id}/entities/{entity_type}/{entity_id}/custom-fields/{field_id}/value")
async def set_custom_field_value(
    book_id: UUID,
    entity_type: str,
    entity_id: UUID,
    field_id: UUID,
    request: CustomFieldValueSetRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Set or update a custom field value for an entity"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Verify field belongs to this book
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.book_id == book_id,
    ).first()
    
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found")
    
    if field.entity_type != entity_type:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Field entity type mismatch")
    
    # Get or create field value
    field_value = db.query(CustomFieldValue).filter(
        CustomFieldValue.custom_field_id == field_id,
        CustomFieldValue.entity_type == entity_type,
        CustomFieldValue.entity_id == entity_id,
    ).first()
    
    if not field_value:
        field_value = CustomFieldValue(
            custom_field_id=field_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        db.add(field_value)
    
    field_value.value = request.value
    db.commit()
    db.refresh(field_value)
    
    return field_value.to_dict()


@router.delete("/{book_id}/entities/{entity_type}/{entity_id}/custom-fields/{field_id}/value", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field_value(
    book_id: UUID,
    entity_type: str,
    entity_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a custom field value for an entity"""
    
    # Verify book exists and user owns it
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    # Verify field belongs to this book
    field = db.query(CustomField).filter(
        CustomField.id == field_id,
        CustomField.book_id == book_id,
    ).first()
    
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom field not found")
    
    # Delete field value
    field_value = db.query(CustomFieldValue).filter(
        CustomFieldValue.custom_field_id == field_id,
        CustomFieldValue.entity_type == entity_type,
        CustomFieldValue.entity_id == entity_id,
    ).first()
    
    if field_value:
        db.delete(field_value)
        db.commit()
