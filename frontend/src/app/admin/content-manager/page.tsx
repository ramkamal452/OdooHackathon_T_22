'use client';

import { useAdminPage } from '@/app/admin/AdminPageContext';
import ContentManager from '@/components/ContentManager';
import { useEffect } from 'react';

export default function AdminContentManagerPage() {
  const { setHeader } = useAdminPage();

  useEffect(() => {
    setHeader({
      title: 'Content Manager',
      subtitle:
        'Create and manage all content in any hierarchy — modules, lessons, quizzes, videos, resources.',
    });
  }, [setHeader]);

  return (
    <div className="space-y-6">
      <ContentManager />
    </div>
  );
}
