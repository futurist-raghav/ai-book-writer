'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';
import { apiClient } from '@/lib/api-client';
import { ProjectType, ProjectTypeConfigService } from '@/lib/project-types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  moduleId: string;
  requiresProjectType?: ProjectType[];
}

interface WorkspaceTerminology {
  characters_label: string;
  world_building_label: string;
  timeline_label: string;
  flow_label: string;
  notes_label: string;
  references_label: string;
  part_singular: string;
  part_plural: string;
  chapter_singular: string;
  chapter_plural: string;
  section_singular: string;
  section_plural: string;
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
    href: '/dashboard/writing-motivation',
    label: 'Motivation Hub',
    icon: 'emoji_events',
    moduleId: 'writing_motivation',
  },
  {
    href: '/dashboard/publishing-pipeline',
    label: 'Publishing Guide',
    icon: 'publish',
    moduleId: 'publishing_pipeline',
  },
  {
    href: '/dashboard/author-directory',
    label: 'Author Directory',
    icon: 'people',
    moduleId: 'author_directory',
  },
  {
    href: '/dashboard/author-messages',
    label: 'Messages',
    icon: 'mail',
    moduleId: 'author_messages',
  },
  {
    href: '/dashboard/writing-groups',
    label: 'Writing Groups',
    icon: 'group_work',
    moduleId: 'writing_groups',
  },
  {
    href: '/dashboard/subscription',
    label: 'Subscription',
    icon: 'star',
    moduleId: 'subscription',
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
  {
    href: '/dashboard/integrations',
    label: 'Integrations',
    icon: 'api',
    moduleId: 'integrations',
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

function dedupeNavItems(items: NavItem[]): NavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) {
      return false;
    }
    seen.add(item.href);
    return true;
  });
}

/**
 * Get adaptive sidebar items based on project type and terminology
 */
function getAdaptiveSidebarItems(
  projectType?: ProjectType | null,
  terminology?: WorkspaceTerminology
): NavItem[] {
  if (!projectType) {
    // Fallback to default items if no project type
    return dedupeNavItems([
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
    ]);
  }

  const config = ProjectTypeConfigService.getConfig(projectType as ProjectType);
  const visibleModules = Array.isArray(config.visibleModules) ? config.visibleModules : [];
  
  // Map visible modules to nav items
  const items: NavItem[] = [];
  
  for (const moduleId of visibleModules) {
    if (moduleId === 'settings') continue; // Settings handled separately
    if (MODULE_NAV_MAP[moduleId]) {
      items.push({
        ...MODULE_NAV_MAP[moduleId],
        label: getAdaptiveLabel(moduleId, projectType, terminology),
      });
    }
  }

  return dedupeNavItems([...items, ...GLOBAL_ITEMS, ...FIXED_ITEMS]);
}

/**
 * Get adaptive label for a module based on project type and custom terminology
 */
function getAdaptiveLabel(
  moduleId: string,
  projectType: ProjectType,
  terminology?: WorkspaceTerminology
): string {
  const config = ProjectTypeConfigService.getConfig(projectType);

  const labelMap: Record<string, string> = {
    overview: 'Overview',
    structure: terminology?.chapter_singular || config.structureUnitName,
    entities: terminology?.characters_label || config.entityConfig.pageName,
    flow: terminology?.flow_label || config.flowPageName,
    notes_voice: terminology?.notes_label ? terminology.notes_label : 'Notes & Voice',
    media: 'Media',
    references: terminology?.references_label || 'References',
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
  
  // Fetch workspace customization
  const { data: customization } = useQuery({
    queryKey: ['workspace-customization', selectedBook?.id],
    queryFn: () => 
      apiClient.workspaceCustomization.get(selectedBook!.id) as Promise<{
        terminology?: WorkspaceTerminology;
      }>,
    enabled: !!selectedBook?.id,
  });
  
  const navItems = getAdaptiveSidebarItems(activeProjectType, customization?.terminology);
  
  const displayBook = selectedBook && String(selectedBook.status) !== 'draft' ? selectedBook : null;

  // Get adaptive labels
  const entityLabel = activeProjectType 
    ? ProjectTypeConfigService.getConfig(activeProjectType as ProjectType).entityConfig.pageName
    : 'Characters & World';
  
  const structureLabel = activeProjectType
    ? ProjectTypeConfigService.getConfig(activeProjectType as ProjectType).structureUnitName
    : 'Chapters';

  return (
    <nav className="scrollbar-sleek hidden h-full w-72 flex-col overflow-y-auto border-r border-outline-variant/35 bg-surface-container-low/85 px-5 py-6 backdrop-blur-xl lg:flex">
      {/* Current Manuscript Section */}
      <div className="mb-8">
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          Current Manuscript
        </h3>
        <div className="theme-chip flex items-center gap-3 rounded-xl p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/14 text-sm font-bold italic text-primary">
            {displayBook?.title ? displayBook.title.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="truncate text-sm font-bold text-on-surface">
              {displayBook?.title || 'No Active Project Selected'}
            </p>
            {activeProjectType && (
              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
                {ProjectTypeConfigService.getDisplayName(activeProjectType as ProjectType)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-grow space-y-1">
        <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
          Workspace
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-[0_10px_18px_-14px_hsl(var(--primary))]'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>

      {/* Support Footer */}
      <div className="space-y-2 border-t border-outline-variant/35 pt-5">
        <a
          href="/support"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-sm">help</span>
          Support
        </a>
      </div>
    </nav>
  );
}

/**
 * Mobile bottom bar that adapts based on project type and terminology
 */
export function AdaptiveBottomBar({ projectType }: SidebarProps) {
  const pathname = usePathname();
  const { selectedBook } = useBookStore();
  
  const activeProjectType = (projectType || selectedBook?.project_type) as ProjectType | undefined;
  
  // Fetch workspace customization
  const { data: customization } = useQuery({
    queryKey: ['workspace-customization', selectedBook?.id],
    queryFn: () => 
      apiClient.workspaceCustomization.get(selectedBook!.id) as Promise<{
        terminology?: WorkspaceTerminology;
      }>,
    enabled: !!selectedBook?.id,
  });
  
  // For mobile, show only essential modules
  const essentialModules = ['overview', 'structure', 'entities', 'flow', 'media', 'settings'];
  const navItems = getAdaptiveSidebarItems(activeProjectType, customization?.terminology).filter(item =>
    essentialModules.includes(item.moduleId) || item.moduleId === 'settings'
  );

  return (
    <nav className="scrollbar-sleek fixed bottom-0 left-0 z-50 h-20 w-full overflow-x-auto border-t border-outline-variant/35 bg-surface/90 px-2 shadow-[0_-4px_20px_hsl(var(--foreground)/0.18)] backdrop-blur-xl lg:hidden">
      <div className="min-w-max h-full flex items-center gap-4 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 min-w-[68px]',
                isActive ? 'text-primary' : 'text-on-surface-variant'
              )}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-bold uppercase">{item.label}</span>
            </a>
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
