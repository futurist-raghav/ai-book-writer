"""
Project template definitions.

These templates provide starter chapter structures by project type.
"""

from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional


TemplateChapter = Dict[str, Any]
ProjectTemplate = Dict[str, Any]

_TEMPLATES_FILE = Path(__file__).with_name("project_templates.json")

@lru_cache(maxsize=1)
def _load_templates() -> Dict[str, ProjectTemplate]:
    with _TEMPLATES_FILE.open("r", encoding="utf-8") as template_file:
        raw_templates = json.load(template_file)

    if not isinstance(raw_templates, dict):
        raise ValueError("project_templates.json must be a JSON object keyed by template id")

    templates: Dict[str, ProjectTemplate] = {}
    for template_id, template_data in raw_templates.items():
        if not isinstance(template_data, dict):
            raise ValueError(f"Template '{template_id}' must be a JSON object")

        normalized_template = deepcopy(template_data)
        normalized_template.setdefault("id", template_id)

        chapter_structure = normalized_template.get("chapter_structure") or []
        normalized_template["chapter_count"] = int(
            normalized_template.get("chapter_count") or len(chapter_structure)
        )

        initial_metadata = normalized_template.get("initial_metadata")
        normalized_template["initial_metadata"] = (
            initial_metadata if isinstance(initial_metadata, dict) else {}
        )

        templates[normalized_template["id"]] = normalized_template

    return templates


PROJECT_TEMPLATES: Dict[str, ProjectTemplate] = _load_templates()


def get_project_template(template_id: str) -> Optional[ProjectTemplate]:
    """Return a deep copy of a project template by id."""
    template = PROJECT_TEMPLATES.get(template_id)
    if not template:
        return None
    return deepcopy(template)


def list_project_templates(project_type: Optional[str] = None) -> List[ProjectTemplate]:
    """List templates, optionally filtered by project type."""
    templates = [deepcopy(template) for template in PROJECT_TEMPLATES.values()]
    if not project_type:
        return templates
    return [template for template in templates if template.get("project_type") == project_type]
