import type { Metadata } from 'next';
import { Sidebar, BottomBar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardKeyboardShortcuts } from '@/components/dashboard-keyboard-shortcuts';
import { PwaRuntime } from '@/components/pwa/pwa-runtime';

export const metadata: Metadata = {
  title: 'Dashboard | Scribe House',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardKeyboardShortcuts>
      <div className="flex min-h-screen flex-col overflow-hidden bg-surface text-on-surface">
        <Header />
        <PwaRuntime />
        <div className="flex flex-1 overflow-hidden pt-20">
          <Sidebar />
          <main className="app-main scrollbar-sleek flex-grow overflow-y-auto px-4 pb-28 pt-8 md:px-8 md:pb-8 lg:px-10">
            <div className="animate-rise">{children}</div>
          </main>
        </div>
        <BottomBar />
      </div>
    </DashboardKeyboardShortcuts>
  );
}
