"""Unit tests for project-level outline generation helpers."""

from app.api.v1.books import (
    _build_project_outline_sections,
    _default_outline_count_for_style,
    _resolve_outline_style,
)


def test_resolve_outline_style_by_project_type_family():
    assert _resolve_outline_style("screenplay") == "screenplay"
    assert _resolve_outline_style("research_paper") == "academic"
    assert _resolve_outline_style("memoir") == "nonfiction"
    assert _resolve_outline_style("songwriting_project") == "song"
    assert _resolve_outline_style("novel") == "fiction"


def test_default_outline_count_per_style():
    assert _default_outline_count_for_style("fiction") == 12
    assert _default_outline_count_for_style("nonfiction") == 10
    assert _default_outline_count_for_style("academic") == 8
    assert _default_outline_count_for_style("screenplay") == 15
    assert _default_outline_count_for_style("song") == 6


def test_build_fiction_outline_has_three_act_parts():
    style, sections = _build_project_outline_sections(
        project_type="novel",
        chapter_count=12,
        project_context="A grieving engineer must choose between duty and family.",
    )

    assert style == "fiction"
    assert len(sections) == 12
    assert sections[0]["part_number"] == 1
    assert sections[0]["part_title"] == "Act I - Setup"
    assert sections[6]["part_number"] == 2
    assert sections[-1]["part_number"] == 3
    assert sections[-1]["part_title"] == "Act III - Resolution"


def test_build_screenplay_outline_uses_scene_chapter_type():
    style, sections = _build_project_outline_sections(
        project_type="screenplay",
        chapter_count=10,
        project_context=None,
    )

    assert style == "screenplay"
    assert len(sections) == 10
    assert all(section["chapter_type"] == "scene" for section in sections)


def test_context_hint_is_applied_to_first_and_last_sections():
    _, sections = _build_project_outline_sections(
        project_type="business_book",
        chapter_count=6,
        project_context=(
            "Help first-time founders build disciplined systems without losing creative momentum."
        ),
    )

    assert "project context" in sections[0]["summary"].lower()
    assert "resolve the core promise" in sections[-1]["summary"].lower()
