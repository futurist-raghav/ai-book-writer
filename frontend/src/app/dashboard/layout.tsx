import type { Metadata } from 'next';
import { Sidebar, BottomBar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { DashboardKeyboardShortcuts } from '@/components/dashboard-keyboard-shortcuts';
import { PwaRuntime } from '@/components/pwa/pwa-runtime';

export const metadata: Metadata = {
  title: 'Dashboard | The Editorial Sanctuary',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardKeyboardShortcuts>
      <div className="flex h-screen flex-col overflow-hidden bg-surface">
        <Header />
        <PwaRuntime />
        <div className="flex flex-1 overflow-hidden pt-20">
          <Sidebar />
          <main className="flex-grow overflow-y-auto px-4 py-8 md:px-8 bg-surface pb-28 md:pb-8">
            {children}
          </main>
        </div>
        <BottomBar />
      </div>
    </DashboardKeyboardShortcuts>
  );
}
