'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  moduleId: string;
  requiresProjectType?: ProjectType[];
}

// Module mapping to navigation items
const MODULE_NAV_MAP: Record<string, NavItem> = {
  overview: {
    href: '/dashboard',
    label: 'Overview',
    icon: 'auto_stories',
    moduleId: 'overview',
  },
  structure: {
    href: '/dashboard/chapters',
    label: 'Chapters',
    icon: 'format_list_bulleted',
    moduleId: 'structure',
  },
  entities: {
    href: '/dashboard/entities',
    label: 'Entities',
    icon: 'groups',
    moduleId: 'entities',
  },
  flow: {
    href: '/dashboard/flow',
    label: 'Flow',
    icon: 'timeline',
    moduleId: 'flow',
  },
  notes_voice: {
    href: '/dashboard/notes-and-voice',
    label: 'Notes & Voice',
    icon: 'settings_voice',
    moduleId: 'notes_voice',
  },
  media: {
    href: '/dashboard/media',
    label: 'Media',
    icon: 'imagesmode',
    moduleId: 'media',
  },
  references: {
    href: '/dashboard/references',
    label: 'References',
    icon: 'library_books',
    moduleId: 'references',
  },
  glossary: {
    href: '/dashboard/glossary',
    label: 'Glossary',
    icon: 'abc',
    moduleId: 'glossary',
  },
  collaboration: {
    href: '/dashboard/collaboration',
    label: 'Collaboration',
    icon: 'people',
    moduleId: 'collaboration',
  },
  publishing: {
    href: '/dashboard/publishing',
    label: 'Publishing',
    icon: 'publish',
    moduleId: 'publishing',
  },
  writing_goals: {
    href: '/dashboard/writing-goals',
    label: 'Writing Goals',
    icon: 'target',
    moduleId: 'writing_goals',
  },
};

// Global items shown outside of project context
const GLOBAL_ITEMS: NavItem[] = [
  {
    href: '/dashboard/marketplace',
    label: 'Marketplace',
    icon: 'storefront',
    moduleId: 'marketplace',
  },
  {
    href: '/dashboard/template-analytics',
    label: 'Template Analytics',
    icon: 'trending_up',
    moduleId: 'template_analytics',
  },
  {
    href: '/dashboard/agents',
    label: 'AI Agents',
    icon: 'bolt',
    moduleId: 'agents',
  },
  {
    href: '/dashboard/writing-performance',
    label: 'Writing Performance',
    icon: 'analytics',
    moduleId: 'writing_performance',
  },
  {
    href: '/dashboard/classrooms',
    label: 'Classrooms',
    icon: 'groups',
    moduleId: 'classrooms',
  },
  {
    href: '/dashboard/public-share',
    label: 'Share Your Book',
    icon: 'share',
    moduleId: 'public_share',
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    icon: 'bar_chart',
    moduleId: 'analytics',
  },
];

// Settings and support are always shown
const FIXED_ITEMS: NavItem[] = [
  {
    href: '/dashboard/project-settings',
    label: 'Settings',
    icon: 'tune',
    moduleId: 'settings',
  },
];

interface SidebarProps {
  projectType?: ProjectType | null;
}

/**
 * Get adaptive sidebar items based on project type
 */
function getAdaptiveSidebarItems(projectType?: ProjectType | null): NavItem[] {
  if (!projectType) {
    // Fallback to default items if no project type
    return [
      MODULE_NAV_MAP.overview,
      MODULE_NAV_MAP.structure,
      MODULE_NAV_MAP.entities,
      MODULE_NAV_MAP.flow,
      MODULE_NAV_MAP.notes_voice,
      MODULE_NAV_MAP.media,
      MODULE_NAV_MAP.references,
      MODULE_NAV_MAP.glossary,
      MODULE_NAV_MAP.collaboration,
      MODULE_NAV_MAP.publishing,
      MODULE_NAV_MAP.writing_goals,
      ...GLOBAL_ITEMS,
      ...FIXED_ITEMS,
    ];
  }

  const config = ProjectTypeConfigService.getConfig(projectType as ProjectType);
  const visibleModules = config.visibleModules;
  
  // Map visible modules to nav items
  const items: NavItem[] = [];
  
  for (const moduleId of visibleModules) {
    if (moduleId === 'settings') continue; // Settings handled separately
    if (MODULE_NAV_MAP[moduleId]) {
      items.push({
        ...MODULE_NAV_MAP[moduleId],
        label: getAdaptiveLabel(moduleId, projectType),
      });
    }
  }

  return [...items, ...GLOBAL_ITEMS, ...FIXED_ITEMS];
}

/**
 * Get adaptive label for a module based on project type
 */
function getAdaptiveLabel(moduleId: string, projectType: ProjectType): string {
  const config = ProjectTypeConfigService.getConfig(projectType);

  const labelMap: Record<string, string> = {
    overview: 'Overview',
    structure: config.structureUnitName,
    entities: config.entityConfig.pageName,
    flow: config.flowPageName,
    notes_voice: 'Notes & Voice',
    media: 'Media',
    references: 'References',
    glossary: 'Glossary',
    collaboration: 'Collaboration',
    publishing: 'Publishing',
    settings: 'Settings',
  };

  return labelMap[moduleId] || moduleId;
}

/**
 * Adaptive sidebar that changes layout and labels based on project type
 */
export function AdaptiveSidebar({ projectType }: SidebarProps) {
  const pathname = usePathname();
  const { selectedBook } = useBookStore();
  
  // Use provided projectType or fallback to selectedBook
  const activeProjectType = (projectType || selectedBook?.project_type) as ProjectType | undefined;
  const navItems = getAdaptiveSidebarItems(activeProjectType);
  
  const displayBook = selectedBook && String(selectedBook.status) !== 'draft' ? selectedBook : null;

  // Get adaptive labels
  const entityLabel = activeProjectType 
    ? ProjectTypeConfigService.getConfig(activeProjectType as ProjectType).entityConfig.pageName
    : 'Characters & World';
  
  const structureLabel = activeProjectType
    ? ProjectTypeConfigService.getConfig(activeProjectType as ProjectType).structureUnitName
    : 'Chapters';

  return (
    <nav className="hidden lg:flex flex-col w-72 h-full bg-slate-50 border-r border-transparent py-8 px-6 overflow-y-auto">
      {/* Current Manuscript Section */}
      <div className="mb-10">
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">
          Current Manuscript
        </h3>
        <div className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-outline-variant/10">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-white italic font-bold">
            {displayBook?.title ? displayBook.title.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-bold text-primary truncate">
              {displayBook?.title || 'No Active Project Selected'}
            </p>
            {activeProjectType && (
              <p className="text-[10px] text-slate-400 uppercase tracking-tighter truncate">
                {ProjectTypeConfigService.getDisplayName(activeProjectType as ProjectType)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="space-y-1 flex-grow">
        <div className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold px-4 mb-3">
          Workspace
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 font-semibold text-xs uppercase tracking-widest transition-all',
                isActive ? 'bg-secondary/10 text-secondary' : 'text-slate-500 hover:bg-white/50'
              )}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Support Footer */}
      <div className="pt-6 border-t border-slate-200/50 space-y-2">
        <Link
          href="/support"
          className="flex items-center gap-3 text-slate-400 px-4 py-2 hover:bg-white/50 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all"
        >
          <span className="material-symbols-outlined text-sm">help</span>
          Support
        </Link>
      </div>
    </nav>
  );
}

/**
 * Mobile bottom bar that adapts based on project type
 */
export function AdaptiveBottomBar({ projectType }: SidebarProps) {
  const pathname = usePathname();
  const { selectedBook } = useBookStore();
  
  const activeProjectType = (projectType || selectedBook?.project_type) as ProjectType | undefined;
  
  // For mobile, show only essential modules
  const essentialModules = ['overview', 'structure', 'entities', 'flow', 'media', 'settings'];
  const navItems = getAdaptiveSidebarItems(activeProjectType).filter(item =>
    essentialModules.includes(item.moduleId) || item.moduleId === 'settings'
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md h-20 px-2 shadow-[0_-4px_20px_rgba(25,28,29,0.06)] z-50 overflow-x-auto">
      <div className="min-w-max h-full flex items-center gap-4 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[68px]',
                isActive ? 'text-primary' : 'text-slate-400'
              )}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-bold uppercase">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Backward compatibility: export original Sidebar as default
 */
export function Sidebar() {
  return <AdaptiveSidebar />;
}

/**
 * Backward compatibility: export original BottomBar as default
 */
export function BottomBar() {
  return <AdaptiveBottomBar />;
}
