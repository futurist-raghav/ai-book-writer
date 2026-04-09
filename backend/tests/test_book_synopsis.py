"""Unit tests for deterministic project synopsis generation helpers."""

from types import SimpleNamespace

from app.api.v1.books import _chapter_synopsis_seed, _fallback_project_synopsis


def _chapter_digest() -> list[dict[str, object]]:
    return [
        {
            "chapter_id": "00000000-0000-0000-0000-000000000001",
            "order": 1,
            "title": "Opening Hook",
            "chapter_type": "chapter",
            "summary": "A courier discovers forbidden records in the capital archive.",
        },
        {
            "chapter_id": "00000000-0000-0000-0000-000000000002",
            "order": 2,
            "title": "Rising Cost",
            "chapter_type": "chapter",
            "summary": "Investigating the records draws attention from rival factions.",
        },
        {
            "chapter_id": "00000000-0000-0000-0000-000000000003",
            "order": 3,
            "title": "Midpoint Turn",
            "chapter_type": "chapter",
            "summary": "An ally betrays the team and reveals a deeper conspiracy.",
        },
        {
            "chapter_id": "00000000-0000-0000-0000-000000000004",
            "order": 4,
            "title": "Final Reckoning",
            "chapter_type": "chapter",
            "summary": "The protagonist exposes the conspiracy and restores public trust.",
        },
    ]


def test_chapter_synopsis_seed_prefers_summary_then_description_then_compiled():
    chapter = SimpleNamespace(
        summary="Summary text",
        description="Description text",
        compiled_content="Compiled text",
    )
    assert _chapter_synopsis_seed(chapter) == "Summary text"

    chapter.summary = ""
    assert _chapter_synopsis_seed(chapter) == "Description text"

    chapter.description = ""
    assert _chapter_synopsis_seed(chapter) == "Compiled text"


def test_one_page_fallback_synopsis_mentions_arc_points():
    synopsis = _fallback_project_synopsis(
        book_title="The Archive Covenant",
        project_type="novel",
        length="one_page",
        project_context="A courier uncovers a state conspiracy and must survive political collapse.",
        chapter_digest=_chapter_digest(),
    )

    assert "The Archive Covenant" in synopsis
    assert "Opening Hook" in synopsis
    assert "Midpoint Turn" in synopsis
    assert "Final Reckoning" in synopsis


def test_three_page_fallback_synopsis_contains_numbered_beats():
    synopsis = _fallback_project_synopsis(
        book_title="The Archive Covenant",
        project_type="novel",
        length="three_page",
        project_context=None,
        chapter_digest=_chapter_digest(),
    )

    assert "The developing arc follows these major beats" in synopsis
    assert "1. Opening Hook" in synopsis
    assert "4. Final Reckoning" in synopsis


def test_full_fallback_synopsis_contains_structured_header():
    synopsis = _fallback_project_synopsis(
        book_title="The Archive Covenant",
        project_type="novel",
        length="full",
        project_context="A courier uncovers a state conspiracy and must survive political collapse.",
        chapter_digest=_chapter_digest(),
    )

    assert "The Archive Covenant - Full Synopsis Draft" in synopsis
    assert "Project type: novel" in synopsis
    assert "4. Final Reckoning" in synopsis


def test_empty_digest_returns_actionable_placeholder():
    synopsis = _fallback_project_synopsis(
        book_title="Draft Project",
        project_type="novel",
        length="one_page",
        project_context=None,
        chapter_digest=[],
    )

    assert "active development" in synopsis
    assert "Add chapter drafts" in synopsis
