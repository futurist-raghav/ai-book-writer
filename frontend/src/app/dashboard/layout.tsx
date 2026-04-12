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
          <main className="flex-grow overflow-y-auto px-4 py-8 md:px-8 bg-[radial-gradient(circle_at_top_right,_rgba(118,153,206,0.14),transparent_45%),radial-gradient(circle_at_15%_85%,_rgba(71,100,92,0.08),transparent_35%),linear-gradient(180deg,_#f8f9fa_0%,_#f3f5f7_100%)] pb-28 md:pb-8">
            {children}
          </main>
        </div>
        <BottomBar />
      </div>
    </DashboardKeyboardShortcuts>
  );
}
