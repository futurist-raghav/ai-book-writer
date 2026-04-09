import { ProjectType } from '@/lib/project-types';

export interface ProjectTemplateChapter {
  title: string;
  chapterType?: string;
  partNumber?: number;
  partTitle?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  projectType: ProjectType;
  description: string;
  chapterStructure: ProjectTemplateChapter[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'three-act-novel',
    name: '3-Act Novel',
    projectType: ProjectType.NOVEL,
    description: 'Classic setup, confrontation, and resolution structure.',
    chapterStructure: [
      { title: 'Prologue', chapterType: 'prologue', partNumber: 1, partTitle: 'Act I: Setup' },
      { title: 'Inciting Incident', chapterType: 'chapter', partNumber: 1, partTitle: 'Act I: Setup' },
      { title: 'Rising Stakes', chapterType: 'chapter', partNumber: 2, partTitle: 'Act II: Confrontation' },
      { title: 'Midpoint Shift', chapterType: 'chapter', partNumber: 2, partTitle: 'Act II: Confrontation' },
      { title: 'Darkest Hour', chapterType: 'chapter', partNumber: 2, partTitle: 'Act II: Confrontation' },
      { title: 'Climax', chapterType: 'chapter', partNumber: 3, partTitle: 'Act III: Resolution' },
      { title: 'Epilogue', chapterType: 'epilogue', partNumber: 3, partTitle: 'Act III: Resolution' },
    ],
  },
  {
    id: 'heros-journey',
    name: "Hero's Journey",
    projectType: ProjectType.NOVEL,
    description: 'Mythic progression from call to return.',
    chapterStructure: [
      { title: 'Ordinary World' },
      { title: 'Call to Adventure' },
      { title: 'Refusal and Mentor' },
      { title: 'Crossing the Threshold' },
      { title: 'Trials and Allies' },
      { title: 'Ordeal' },
      { title: 'Reward' },
      { title: 'Road Back' },
      { title: 'Resurrection' },
      { title: 'Return with the Elixir' },
    ],
  },
  {
    id: 'memoir-chronological',
    name: 'Memoir (Chronological)',
    projectType: ProjectType.MEMOIR,
    description: 'Chronological memoir structure from early years to reflection.',
    chapterStructure: [
      { title: 'Opening Reflection' },
      { title: 'Early Years' },
      { title: 'Turning Points' },
      { title: 'Reckoning' },
      { title: 'Where I Stand Now' },
    ],
  },
  {
    id: 'screenplay-three-act',
    name: 'Screenplay 3-Act',
    projectType: ProjectType.SCREENPLAY,
    description: 'Milestone scenes aligned with the 3-act screenplay arc.',
    chapterStructure: [
      { title: 'Act I - Opening Image', chapterType: 'scene', partNumber: 1, partTitle: 'Act I' },
      { title: 'Act I - Inciting Incident', chapterType: 'scene', partNumber: 1, partTitle: 'Act I' },
      { title: 'Act I - Break into Two', chapterType: 'scene', partNumber: 1, partTitle: 'Act I' },
      { title: 'Act II - Midpoint', chapterType: 'scene', partNumber: 2, partTitle: 'Act II' },
      { title: 'Act II - All Is Lost', chapterType: 'scene', partNumber: 2, partTitle: 'Act II' },
      { title: 'Act III - Finale', chapterType: 'scene', partNumber: 3, partTitle: 'Act III' },
    ],
  },
  {
    id: 'research-paper-standard',
    name: 'Research Paper (IMRaD)',
    projectType: ProjectType.RESEARCH_PAPER,
    description: 'Standard academic paper sections for journals and conferences.',
    chapterStructure: [
      { title: 'Abstract', chapterType: 'section' },
      { title: 'Introduction', chapterType: 'section' },
      { title: 'Literature Review', chapterType: 'section' },
      { title: 'Methodology', chapterType: 'section' },
      { title: 'Results', chapterType: 'section' },
      { title: 'Discussion', chapterType: 'section' },
      { title: 'Conclusion', chapterType: 'section' },
      { title: 'References', chapterType: 'section' },
    ],
  },
  {
    id: 'textbook-outline',
    name: 'Textbook Outline',
    projectType: ProjectType.COLLEGE_TEXTBOOK,
    description: 'Part-based textbook structure with exercises and appendix.',
    chapterStructure: [
      { title: 'Part I - Foundations', chapterType: 'part', partNumber: 1, partTitle: 'Foundations' },
      { title: 'Chapter 1 - Core Concepts', chapterType: 'chapter', partNumber: 1, partTitle: 'Foundations' },
      { title: 'Chapter 2 - Principles and Models', chapterType: 'chapter', partNumber: 1, partTitle: 'Foundations' },
      { title: 'Part II - Applications', chapterType: 'part', partNumber: 2, partTitle: 'Applications' },
      { title: 'Chapter 3 - Guided Examples', chapterType: 'chapter', partNumber: 2, partTitle: 'Applications' },
      { title: 'Chapter 4 - Exercises', chapterType: 'chapter', partNumber: 2, partTitle: 'Applications' },
      { title: 'Appendix', chapterType: 'appendix', partNumber: 3, partTitle: 'Reference' },
    ],
  },
  {
    id: 'academic-course-modules',
    name: 'Academic Course Modules',
    projectType: ProjectType.ACADEMIC_COURSE,
    description: 'Module-based sequence for course material planning.',
    chapterStructure: [
      { title: 'Course Overview', chapterType: 'module' },
      { title: 'Module 1 - Fundamentals', chapterType: 'module' },
      { title: 'Module 2 - Intermediate Topics', chapterType: 'module' },
      { title: 'Module 3 - Advanced Topics', chapterType: 'module' },
      { title: 'Assessments and Rubrics', chapterType: 'module' },
      { title: 'Further Reading', chapterType: 'module' },
    ],
  },
  {
    id: 'five-chapter-non-fiction',
    name: '5-Chapter Non-Fiction',
    projectType: ProjectType.BUSINESS_BOOK,
    description: 'Concise non-fiction arc from problem to action plan.',
    chapterStructure: [
      { title: 'Introduction', chapterType: 'introduction' },
      { title: 'The Core Problem', chapterType: 'chapter' },
      { title: 'Your Framework', chapterType: 'chapter' },
      { title: 'Case Studies and Proof', chapterType: 'chapter' },
      { title: 'Action Plan', chapterType: 'chapter' },
      { title: 'Conclusion', chapterType: 'conclusion' },
    ],
  },
];

export function getProjectTemplate(templateId: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId);
}

export function getTemplatesByProjectType(projectType: ProjectType | string): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((template) => template.projectType === projectType);
}

export function getAllProjectTemplates(): ProjectTemplate[] {
  return PROJECT_TEMPLATES;
}
