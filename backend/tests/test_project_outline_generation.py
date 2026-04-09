"""Unit tests for deterministic project outline generation."""

from app.api.v1.books import (
    _build_project_outline_sections,
    _default_outline_count_for_style,
    _resolve_outline_style,
)


def test_resolves_outline_style_by_project_type():
    assert _resolve_outline_style("screenplay") == "screenplay"
    assert _resolve_outline_style("research_paper") == "academic"
    assert _resolve_outline_style("memoir") == "nonfiction"
    assert _resolve_outline_style("songwriting_project") == "song"
    assert _resolve_outline_style("novel") == "fiction"


def test_defaults_outline_count_per_style():
    assert _default_outline_count_for_style("fiction") == 12
    assert _default_outline_count_for_style("nonfiction") == 10
    assert _default_outline_count_for_style("academic") == 8
    assert _default_outline_count_for_style("screenplay") == 15
    assert _default_outline_count_for_style("song") == 6


def test_builds_screenplay_outline_with_scene_sections():
    style, sections = _build_project_outline_sections(
        project_type="screenplay",
        chapter_count=6,
        project_context="An escalating city heist gone wrong",
    )

    assert style == "screenplay"
    assert len(sections) == 6
    assert all(section["chapter_type"] == "scene" for section in sections)
    assert sections[0]["part_number"] == 1


def test_applies_project_context_hint_to_outline_edges():
    _, sections = _build_project_outline_sections(
        project_type="novel",
        chapter_count=5,
        project_context="A reluctant leader must unite rival houses before winter",
    )

    assert "project context" in sections[0]["summary"].lower()
    assert "project context" in sections[-1]["summary"].lower()
