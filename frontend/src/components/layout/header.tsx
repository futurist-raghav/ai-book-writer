'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {user?.full_name ? getInitials(user.full_name) : <User className="h-4 w-4" />}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
