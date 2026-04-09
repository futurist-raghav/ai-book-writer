"""Unit tests for deterministic chapter consistency checks."""

from app.api.v1.chapters import (
    _build_diff_preview,
    _fallback_expand_notes,
    _run_consistency_checks,
    _run_entity_extraction,
)


def _chapter_payload(
    *,
    chapter_id: str,
    chapter_number: int,
    chapter_order: int,
    title: str,
    text: str,
):
    return {
        "chapter_id": chapter_id,
        "chapter_title": title,
        "chapter_number": chapter_number,
        "chapter_order": chapter_order,
        "text": text,
    }


def test_detects_character_name_variations():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000001",
            chapter_number=1,
            chapter_order=1,
            title="Chapter One",
            text="Jon entered the hall and looked around.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000002",
            chapter_number=2,
            chapter_order=2,
            title="Chapter Two",
            text="John waited near the door, watching closely.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    character_issues = [issue for issue in issues if issue.issue_type == "character_name_variation"]

    assert character_issues
    detected_variants = {variant for issue in character_issues for variant in issue.variants}
    assert "Jon" in detected_variants
    assert "John" in detected_variants


def test_detects_character_appearance_inconsistency():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000021",
            chapter_number=1,
            chapter_order=1,
            title="Before the Mission",
            text="Elena had red hair and watched the gates open.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000022",
            chapter_number=2,
            chapter_order=2,
            title="After the Mission",
            text="Elena's hair was blonde when she returned to camp.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    appearance_issues = [
        issue for issue in issues if issue.issue_type == "character_appearance_inconsistency"
    ]

    assert appearance_issues
    issue = appearance_issues[0]
    assert "Elena" in issue.title
    assert "red hair" in issue.variants
    assert "blonde hair" in issue.variants
    assert len(issue.references) >= 2


def test_detects_location_name_variations():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000003",
            chapter_number=1,
            chapter_order=1,
            title="Arrival",
            text="They met in Rivergate before sunset.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000004",
            chapter_number=2,
            chapter_order=2,
            title="Return",
            text="At dawn, they returned to River Gate with supplies.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    location_issues = [issue for issue in issues if issue.issue_type == "location_name_variation"]

    assert location_issues
    detected_variants = {variant for issue in location_issues for variant in issue.variants}
    assert "Rivergate" in detected_variants
    assert "River Gate" in detected_variants


def test_detects_conflicting_calendar_dates():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000005",
            chapter_number=1,
            chapter_order=1,
            title="Archive Notes",
            text="On March 12, 1888, the treaty was signed.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000006",
            chapter_number=2,
            chapter_order=2,
            title="Conflicting Memo",
            text="Witnesses insisted March 12, 1889 was the real signing day.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    timeline_issues = [issue for issue in issues if issue.issue_type == "timeline_inconsistency"]

    assert timeline_issues
    assert any("Date conflict for March 12" in issue.title for issue in timeline_issues)
    merged_variants = {variant for issue in timeline_issues for variant in issue.variants}
    assert "March 12, 1888" in merged_variants
    assert "March 12, 1889" in merged_variants


def test_detects_chapter_timeline_regression():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000007",
            chapter_number=4,
            chapter_order=4,
            title="Later Period",
            text="The account repeatedly references 1950 and 1951.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000008",
            chapter_number=5,
            chapter_order=5,
            title="Earlier Period",
            text="The next chapter suddenly shifts to 1900 as the dominant year.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    timeline_issues = [issue for issue in issues if issue.issue_type == "timeline_inconsistency"]

    assert any("timeline regression" in issue.title.lower() for issue in timeline_issues)


def test_detects_terminology_inconsistency_pairs():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000111",
            chapter_number=1,
            chapter_order=1,
            title="Definitions",
            text="This chapter defines how the internet evolved across regions.",
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000112",
            chapter_number=2,
            chapter_order=2,
            title="Usage",
            text="Later sections describe how the web changed publishing models.",
        ),
    ]

    issues = _run_consistency_checks(chapters_data)
    terminology_issues = [issue for issue in issues if issue.issue_type == "terminology_inconsistency"]

    assert terminology_issues
    issue = terminology_issues[0]
    assert "internet" in issue.title.lower()
    assert "web" in issue.title.lower()
    assert issue.canonical_value in {"internet", "web"}
    assert issue.references


def test_extracts_entities_with_frequency_and_first_mention():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000009",
            chapter_number=1,
            chapter_order=1,
            title="Opening",
            text=(
                "Elena met Arin in Rivergate at dusk. "
                "She carried the Star Compass while Arin watched."
            ),
        ),
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000010",
            chapter_number=2,
            chapter_order=2,
            title="Return",
            text=(
                "Arin returned to Rivergate and Elena checked the Star Compass again."
            ),
        ),
    ]

    entities = _run_entity_extraction(chapters_data)
    entities_by_name = {entity.name: entity for entity in entities}

    assert "Elena" in entities_by_name
    assert entities_by_name["Elena"].entity_type == "character"
    assert entities_by_name["Elena"].frequency >= 2
    assert entities_by_name["Elena"].first_mention_chapter_number == 1

    assert "Rivergate" in entities_by_name
    assert entities_by_name["Rivergate"].entity_type == "location"
    assert entities_by_name["Rivergate"].frequency >= 2
    assert entities_by_name["Rivergate"].first_mention_chapter_number == 1

    assert "Star Compass" in entities_by_name
    assert entities_by_name["Star Compass"].entity_type == "object"
    assert entities_by_name["Star Compass"].frequency >= 2
    assert entities_by_name["Star Compass"].context_snippet


def test_filters_single_mention_single_word_objects():
    chapters_data = [
        _chapter_payload(
            chapter_id="00000000-0000-0000-0000-000000000011",
            chapter_number=1,
            chapter_order=1,
            title="Single Mention",
            text="Mira grabbed the Lantern before leaving camp.",
        )
    ]

    entities = _run_entity_extraction(chapters_data)
    names = {entity.name for entity in entities}

    assert "Lantern" not in names


def test_fallback_expand_notes_preserves_note_points():
    notes = """
    - Elena arrives before dawn
    - She hides the Star Compass beneath the archive stairs
    - Alarm bells force the team to evacuate
    """

    expanded = _fallback_expand_notes("Archive Entry", notes)

    assert "Archive Entry" in expanded
    assert "Elena arrives before dawn" in expanded
    assert "Star Compass" in expanded
    assert "Alarm bells force the team to evacuate" in expanded


def test_build_diff_preview_returns_unified_diff_markers():
    notes = "Elena arrives\nCompass is hidden"
    expanded = "Elena arrives before dawn.\nThe Star Compass is hidden beneath the stairs."

    diff_preview = _build_diff_preview(notes, expanded)

    assert "--- notes" in diff_preview
    assert "+++ expanded" in diff_preview
    assert "+The Star Compass is hidden beneath the stairs." in diff_preview
