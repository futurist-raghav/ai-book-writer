'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AudioRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/notes-and-voice');
  }, [router]);

  return null;
}
