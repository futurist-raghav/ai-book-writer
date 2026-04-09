'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CharactersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/entities');
  }, [router]);

  return null;
}
