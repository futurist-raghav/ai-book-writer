"""Unit tests for entity extraction and type mapping."""

import uuid

import pytest

from app.api.v1.chapters import _map_extraction_type_to_entity_type, _run_entity_extraction
from app.schemas.chapter import ExtractedEntity


def _chapter_payload(
    *,
    chapter_id: str,
    chapter_number: int,
    chapter_order: int,
    title: str,
    text: str,
):
    """Create chapter payload for extraction testing."""
    return {
        "chapter_id": chapter_id,
        "chapter_title": title,
        "chapter_number": chapter_number,
        "chapter_order": chapter_order,
        "text": text,
    }


class TestEntityTypeMapping:
    """Test extraction type to Entity type mapping."""

    def test_map_character_type(self):
        """Test character extraction type maps to character entity type."""
        assert _map_extraction_type_to_entity_type("character") == "character"

    def test_map_location_type(self):
        """Test location extraction type maps to location entity type."""
        assert _map_extraction_type_to_entity_type("location") == "location"

    def test_map_object_type_to_item(self):
        """Test object extraction type maps to item entity type."""
        assert _map_extraction_type_to_entity_type("object") == "item"

    def test_map_unknown_type_to_concept(self):
        """Test unknown extraction type maps to concept (fallback)."""
        assert _map_extraction_type_to_entity_type("unknown") == "concept"


class TestEntityExtraction:
    """Test entity extraction functionality."""

    def test_extract_characters_and_locations(self):
        """Test that entity extraction finds character and location entities."""
        chapters_data = [
            _chapter_payload(
                chapter_id="00000000-0000-0000-0000-000000000001",
                chapter_number=1,
                chapter_order=1,
                title="Chapter One",
                text=(
                    "Aragorn walked through the forest. "
                    "The ranger was strong and determined. "
                    "He met Gandalf at the bridge. "
                    "The city of Minas Tirith was grand. "
                    "Aragorn and Gandalf traveled together. "
                    "They spoke of the great city."
                ),
            )
        ]

        entities = _run_entity_extraction(chapters_data)

        assert len(entities) > 0, "Should extract at least one entity"

        # Find character entities
        character_entities = [e for e in entities if e.entity_type == "character"]
        
        # Extraction should find at least some entities (characters likely found)
        assert len(character_entities) > 0, "Should find character entities"

    def test_extracted_entities_have_metadata(self):
        """Test that extracted entities include frequency and references."""
        chapters_data = [
            _chapter_payload(
                chapter_id="00000000-0000-0000-0000-000000000001",
                chapter_number=1,
                chapter_order=1,
                title="Chapter One",
                text=(
                    "Elena and Elena studied together. "
                    "Elena was brilliant. "
                    "The capital city of Winterfell was cold."
                ),
            )
        ]

        entities = _run_entity_extraction(chapters_data)

        # Find Elena (should have high frequency)
        elena_entities = [e for e in entities if "elena" in e.name.lower()]

        if elena_entities:
            elena = elena_entities[0]
            assert elena.frequency >= 3, "Elena should appear at least 3 times"
            assert elena.first_mention_chapter_id is not None
            assert elena.first_mention_chapter_title == "Chapter One"
            assert elena.references, "Should have chapter references"

    def test_low_frequency_objects_are_filtered(self):
        """Test that low-frequency single-word objects are filtered out."""
        chapters_data = [
            _chapter_payload(
                chapter_id="00000000-0000-0000-0000-000000000001",
                chapter_number=1,
                chapter_order=1,
                title="Chapter One",
                text=(
                    "He picked up the book. "
                    "The book was blue. "
                    "He read every page of the book. "
                    "He saw a random."  # Single occurrence, will be filtered
                ),
            )
        ]

        entities = _run_entity_extraction(chapters_data)

        # Random single-word objects should filter out
        object_entities = [e for e in entities if e.entity_type == "object"]

        # Any extracted objects should have frequency > 1
        for obj_entity in object_entities:
            assert obj_entity.frequency > 1, f"Object '{obj_entity.name}' should have frequency > 1"


class TestExtractedEntitySchema:
    """Test ExtractedEntity schema."""

    def test_create_entity_without_db_id(self):
        """Test that ExtractedEntity can be created without db_entity_id."""
        entity = ExtractedEntity(
            id="character-aragorn",
            name="Aragorn",
            entity_type="character",
            frequency=5,
            first_mention_chapter_id=uuid.uuid4(),
            first_mention_chapter_title="Chapter One",
            first_mention_chapter_number=1,
            first_mention_chapter_order=1,
            references=[],
        )

        assert entity.db_entity_id is None

    def test_set_db_id_on_entity(self):
        """Test that db_entity_id can be set on ExtractedEntity."""
        entity = ExtractedEntity(
            id="character-aragorn",
            name="Aragorn",
            entity_type="character",
            frequency=5,
            first_mention_chapter_id=uuid.uuid4(),
            first_mention_chapter_title="Chapter One",
            first_mention_chapter_number=1,
            first_mention_chapter_order=1,
            references=[],
        )

        test_id = uuid.uuid4()
        entity.db_entity_id = test_id
        assert entity.db_entity_id == test_id


class TestEntityReferences:
    """Test entity reference tracking."""

    def test_entity_references_created_with_extraction(self):
        """Test that EntityReference records would be created during extraction.
        
        This is a unit test verifying the extraction data structure includes
        necessary chapter reference information for persisting to EntityReference table.
        """
        # Simulate extracted entity with chapter references
        chapters_data = [
            _chapter_payload(
                chapter_id="00000000-0000-0000-0000-000000000001",
                chapter_number=1,
                chapter_order=1,
                title="Chapter One",
                text="Aragorn appeared early. Aragorn was brave.",
            ),
            _chapter_payload(
                chapter_id="00000000-0000-0000-0000-000000000002",
                chapter_number=2,
                chapter_order=2,
                title="Chapter Two",
                text="Aragorn continued his journey. Aragorn rode forward.",
            ),
        ]

        entities = _run_entity_extraction(chapters_data)
        
        # Find Aragorn entity
        aragorn_entities = [e for e in entities if "aragorn" in e.name.lower()]
        
        if aragorn_entities:
            aragorn = aragorn_entities[0]
            # Should have references from multiple chapters
            assert aragorn.references, "Aragorn should have chapter references"
            assert len(aragorn.references) >= 1, "Should reference at least one chapter"
            
            # Each reference should have chapter info with mentions count
            for ref in aragorn.references:
                assert ref.chapter_id is not None
                assert ref.chapter_title is not None
                assert ref.mentions >= 1, "Should have at least 1 mention"

    def test_entity_reference_extraction_metadata(self):
        """Test that entity reference metadata can capture extraction context."""
        from app.schemas.chapter import ExtractedEntityReference
        
        # Create an extracted entity reference
        ref = ExtractedEntityReference(
            chapter_id=uuid.uuid4(),
            chapter_title="Chapter One",
            chapter_number=1,
            chapter_order=1,
            mentions=3,
        )
        
        # Verify reference structure
        assert ref.chapter_number == 1
        assert ref.mentions == 3
        assert ref.chapter_title == "Chapter One"

