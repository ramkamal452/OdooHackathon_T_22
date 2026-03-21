'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'admin') {
      router.replace('/admin');
      return;
    }
    if (user.role === 'learner') {
      router.replace('/dashboard/learner');
      return;
    }
    if (user.role === 'instructor') {
      router.replace('/dashboard/instructor');
    }
  }, [user, loading, router]);

  return (
    <div className="surface-bg flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
    </div>
  );
}
