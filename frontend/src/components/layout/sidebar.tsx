'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  FileText,
  Layers,
  Mic,
  Settings,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/audio', label: 'Audio', icon: Mic },
  { href: '/dashboard/events', label: 'Events', icon: FileText },
  { href: '/dashboard/chapters', label: 'Chapters', icon: Layers },
  { href: '/dashboard/books', label: 'Books', icon: BookOpen },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-card lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-bold">AI Book Writer</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">
            © 2024 AI Book Writer
          </p>
        </div>
      </div>
    </aside>
  );
}
