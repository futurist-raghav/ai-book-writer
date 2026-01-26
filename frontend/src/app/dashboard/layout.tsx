import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export const metadata: Metadata = {
  title: 'Dashboard | AI Book Writer',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
