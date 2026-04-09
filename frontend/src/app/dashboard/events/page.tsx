'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface Event {
  id: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  category?: string;
  tags?: string[];
  location?: string;
  people?: Array<string | { name: string; relationship?: string }>;
  sentiment?: string;
  is_featured: boolean;
  order_index: number;
  created_at?: string;
  event_date?: string;
}

export default function EventsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/flow');
  }, [router]);

  return null;
}
