'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useKeyboardShortcutsContext } from '@/stores/keyboard-shortcuts-context';
import { cn } from '@/lib/utils';

const topNav = [
  { href: '/dashboard/books', label: 'Projects' },
  { href: '/dashboard/drafts', label: 'Drafts' },
  { href: '/dashboard/archive', label: 'Archive' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const { openHelp } = useKeyboardShortcutsContext();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 z-50 w-full px-6 md:px-8 h-20 flex justify-between items-center bg-[#f8f9fa]/80 backdrop-blur-md shadow-[0_4px_20px_rgba(25,28,29,0.06)]">
      <div className="flex items-center gap-6">
        <div>
          <span className="text-xs text-secondary font-semibold uppercase tracking-widest block mb-0.5">Workspace</span>
          <h1 className="text-xl font-bold text-primary italic font-headline tracking-tight">The Editorial Sanctuary</h1>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-8 mr-8">
          {topNav.map((item) => {
            const active = pathname === item.href || (item.href === '/dashboard/books' && pathname === '/dashboard');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'font-label text-sm transition-colors duration-300 pb-1 border-b-2',
                  active
                    ? 'text-primary font-bold border-primary'
                    : 'text-primary/60 hover:text-primary border-transparent'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        
        <button className="material-symbols-outlined text-primary/70 hover:bg-surface-container-low p-2 rounded-full transition-all" title="History">history</button>
        <button 
          onClick={openHelp}
          className="material-symbols-outlined text-primary/70 hover:bg-surface-container-low p-2 rounded-full transition-all"
          title="Help & Keyboard Shortcuts (?)"
        >
          help_outline
        </button>
        <Link href="/dashboard/settings" className="material-symbols-outlined text-primary/70 hover:bg-surface-container-low p-2 rounded-full transition-all" title="Settings">
          settings
        </Link>
        <button 
          onClick={handleLogout}
          className="material-symbols-outlined text-primary/70 hover:bg-surface-container-low p-2 rounded-full transition-all"
          title="Logout"
        >
          logout
        </button>
      </div>
    </header>
  );
}
