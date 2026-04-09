/**
 * Project Type Selector Component
 * Used in project creation flow and settings to choose/change project type
 */

'use client';

import { ProjectType, PROJECT_TYPE_CATEGORIES, ProjectTypeConfigService } from '@/lib/project-types';

interface ProjectTypeSelectorProps {
  value: ProjectType | string;
  onChange: (type: ProjectType) => void;
  disabled?: boolean;
  showDescriptions?: boolean;
}

/**
 * Compact dropdown version for settings/edit
 */
export function ProjectTypeDropdown({ value, onChange, disabled = false }: ProjectTypeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProjectType)}
      disabled={disabled}
      className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium
                 disabled:opacity-50 disabled:cursor-not-allowed
                 focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <option value="">Select a project type...</option>
      {Object.entries(PROJECT_TYPE_CATEGORIES).map(([category, types]) => (
        <optgroup key={category} label={category}>
          {types.map((type) => (
            <option key={type} value={type}>
              {ProjectTypeConfigService.getDisplayName(type as ProjectType)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Grid card selector for project creation wizard
 */
export function ProjectTypeSelector({ value, onChange, disabled = false, showDescriptions = true }: ProjectTypeSelectorProps) {
  const descriptions: Record<ProjectType, string> = {
    [ProjectType.NOVEL]: "Classic fiction with chapters, characters, and complex plots",
    [ProjectType.MEMOIR]: "True life story with chapters, people, and personal events",
    [ProjectType.SHORT_STORY_COLLECTION]: "Multiple independent short stories with shared themes",
    [ProjectType.POETRY_COLLECTION]: "Collection of poems with verse structure and imagery",
    [ProjectType.FANFICTION]: "Derivative fiction building on existing worlds and characters",
    [ProjectType.INTERACTIVE_FICTION]: "Branching narrative with reader choices and alternate paths",
    [ProjectType.SCREENPLAY]: "Industry-standard film/TV script with scenes and dialogue",
    [ProjectType.TV_SERIES_BIBLE]: "Master guide for a multi-season television series",
    [ProjectType.GRAPHIC_NOVEL_SCRIPT]: "Comic script with visual descriptions and panel layout",
    [ProjectType.COMIC_SCRIPT]: "Multi-issue comic series with visual storytelling",
    [ProjectType.SONGWRITING_PROJECT]: "Album or EP with multiple tracks and lyrics",
    [ProjectType.PODCAST_SCRIPT]: "Multi-episode podcast with consistent format",
    [ProjectType.AUDIOBOOK_SCRIPT]: "Narrated book with audio-specific production notes",
    [ProjectType.RESEARCH_PAPER]: "Academic paper with citations, abstract, and methodology",
    [ProjectType.THESIS_DISSERTATION]: "Graduate thesis with comprehensive research and analysis",
    [ProjectType.K12_TEXTBOOK]: "Educational material for K-12 students with lessons",
    [ProjectType.COLLEGE_TEXTBOOK]: "University-level textbook with chapters and exercises",
    [ProjectType.ACADEMIC_COURSE]: "Complete course curriculum with modules and assessments",
    [ProjectType.TECHNICAL_DOCUMENTATION]: "Software/hardware documentation with procedures and examples",
    [ProjectType.BUSINESS_BOOK]: "Professional book covering business concepts and case studies",
    [ProjectType.MANAGEMENT_BOOK]: "Management guide with frameworks and real-world examples",
    [ProjectType.SELF_HELP_BOOK]: "Self-improvement guide with actionable strategies",
    [ProjectType.LEGAL_DOCUMENT]: "Contract or legal document with clauses and definitions",
    [ProjectType.PERSONAL_JOURNAL]: "Private journal with daily/regular entries",
    [ProjectType.EXPERIMENTAL]: "Custom project type with flexible structure",
  };

  return (
    <div className="w-full">
      {Object.entries(PROJECT_TYPE_CATEGORIES).map(([category, types]) => (
        <div key={category} className="mb-8">
          <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {types.map((type) => {
              const isSelected = value === type;
              const config = ProjectTypeConfigService.getConfig(type as ProjectType);

              return (
                <button
                  key={type}
                  onClick={() => onChange(type as ProjectType)}
                  disabled={disabled}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all text-left
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 bg-white hover:border-primary/30 hover:bg-slate-50'
                    }
                  `}
                >
                  {/* Selection checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm">check</span>
                    </div>
                  )}

                  {/* Type label */}
                  <p className="font-semibold text-sm text-slate-900 pr-6">
                    {ProjectTypeConfigService.getDisplayName(type as ProjectType)}
                  </p>

                  {/* Description */}
                  {showDescriptions && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {descriptions[type as ProjectType] || 'Creative project'}
                    </p>
                  )}

                  {/* Unit name hint */}
                  <p className="text-xs text-slate-400 mt-2 italic">
                    Uses: {config.structureUnitName}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Minimal inline selector for quick switching
 */
export function ProjectTypeInlineSelector({ value, onChange }: ProjectTypeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 font-medium">Project Type:</span>
      <div className="inline-block px-3 py-1 bg-slate-100 rounded-full">
        <span className="text-sm font-semibold text-slate-900">
          {ProjectTypeConfigService.getDisplayName(value as ProjectType)}
        </span>
      </div>
    </div>
  );
}
