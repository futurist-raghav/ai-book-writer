'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorldBuildingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/entities');
  }, [router]);

  return null;
}
