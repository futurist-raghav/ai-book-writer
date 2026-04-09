'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IllustrationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/media');
  }, [router]);

  return null;
}
