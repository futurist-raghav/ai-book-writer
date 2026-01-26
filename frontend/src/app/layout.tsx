import type { Metadata } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/lib/query-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const merriweather = Merriweather({
  weight: ['300', '400', '700', '900'],
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'AI Book Writer',
  description: 'Transform your voice recordings into professionally formatted books using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${merriweather.variable} font-sans antialiased`}>
        <QueryProvider>
          {children}
          <Toaster position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
