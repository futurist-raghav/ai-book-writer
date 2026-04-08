'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBookStore } from '@/stores/book-store';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: 'auto_stories' },
  { href: '/dashboard/chapters', label: 'Chapters', icon: 'format_list_bulleted' },
  { href: '/dashboard/characters', label: 'Characters', icon: 'groups' },
  { href: '/dashboard/world', label: 'World Building', icon: 'landscape' },
  { href: '/dashboard/audio', label: 'Audio Notes', icon: 'settings_voice' },
  { href: '/dashboard/events', label: 'Event Spine', icon: 'timeline' },
  { href: '/dashboard/illustrations', label: 'Illustrations', icon: 'imagesmode' },
  { href: '/dashboard/project-settings', label: 'Project Settings', icon: 'tune' },
];

const uniqueNavItems = navItems.filter(
  (item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index
);

export function Sidebar() {
  const pathname = usePathname();
  const { selectedBook } = useBookStore();
  const displayBook = selectedBook && String(selectedBook.status) !== 'draft' ? selectedBook : null;

  return (
    <nav className="hidden lg:flex flex-col w-72 h-full bg-slate-50 border-r border-transparent py-8 px-6 overflow-y-auto">
      <div className="mb-10">
        <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Current Manuscript</h3>
        <div className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-outline-variant/10">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-white italic font-bold">
            {displayBook?.title ? displayBook.title.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-primary truncate">{displayBook?.title || 'No Active Project Selected'}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-tighter truncate">Choose from Projects</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 flex-grow">
        {uniqueNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 font-semibold text-xs uppercase tracking-widest transition-all",
                isActive 
                  ? "bg-secondary/10 text-secondary" 
                  : "text-slate-500 hover:bg-white/50"
              )}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span> 
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="pt-6 border-t border-slate-200/50 space-y-2">
        <Link href="/support" className="flex items-center gap-3 text-slate-400 px-4 py-2 hover:bg-white/50 rounded-lg text-[10px] uppercase tracking-[0.15em] transition-all">
          <span className="material-symbols-outlined text-sm">help</span> Support
        </Link>
      </div>
    </nav>
  );
}

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md h-20 px-2 shadow-[0_-4px_20px_rgba(25,28,29,0.06)] z-50 overflow-x-auto">
      <div className="min-w-max h-full flex items-center gap-4 px-2">
      {uniqueNavItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[68px]",
              isActive ? "text-primary" : "text-slate-400"
            )}
          >
            <span className="material-symbols-outlined text-2xl" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
            <span className="text-[10px] font-bold uppercase">{item.label}</span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
