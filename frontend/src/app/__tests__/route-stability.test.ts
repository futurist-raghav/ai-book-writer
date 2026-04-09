import fs from 'fs';
import path from 'path';

function hasRoutePage(route: string): boolean {
  const normalized = route.replace(/^\//, '');
  const fullPath = path.join(process.cwd(), 'src', 'app', normalized, 'page.tsx');
  return fs.existsSync(fullPath);
}

describe('dashboard route stability', () => {
  it('keeps all primary navigation targets mapped to real pages', () => {
    const expectedRoutes = [
      '/dashboard',
      '/dashboard/books',
      '/dashboard/drafts',
      '/dashboard/archive',
      '/dashboard/settings',
      '/dashboard/project-settings',
      '/dashboard/chapters',
      '/dashboard/entities',
      '/dashboard/flow',
      '/dashboard/notes-and-voice',
      '/dashboard/media',
      '/dashboard/references',
      '/dashboard/collaboration',
      '/dashboard/publishing',
      '/support',
    ];

    const missing = expectedRoutes.filter((route) => !hasRoutePage(route));
    expect(missing).toEqual([]);
  });

  it('keeps redirect routes mapped for compatibility', () => {
    const redirectRoutes = [
      '/dashboard/audio',
      '/dashboard/characters',
      '/dashboard/events',
      '/dashboard/illustrations',
      '/dashboard/world',
      '/dashboard/world-building',
    ];

    const missing = redirectRoutes.filter((route) => !hasRoutePage(route));
    expect(missing).toEqual([]);
  });

  it('keeps chapter dynamic routes available', () => {
    const chapterWorkspace = path.join(
      process.cwd(),
      'src',
      'app',
      'dashboard',
      'chapters',
      '[chapterId]',
      'page.tsx'
    );
    const chapterVersions = path.join(
      process.cwd(),
      'src',
      'app',
      'dashboard',
      'chapters',
      '[chapterId]',
      'versions',
      'page.tsx'
    );

    expect(fs.existsSync(chapterWorkspace)).toBe(true);
    expect(fs.existsSync(chapterVersions)).toBe(true);
  });
});
