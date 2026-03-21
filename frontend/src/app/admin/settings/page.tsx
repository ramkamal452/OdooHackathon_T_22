'use client';

import { useAdminPage } from '@/app/admin/AdminPageContext';
import { useEffect } from 'react';

export default function AdminSettingsPage() {
  const { setHeader } = useAdminPage();

  useEffect(() => {
    setHeader({
      title: 'Settings',
      subtitle: 'Configure admin preferences.',
      searchPlaceholder: 'Search settings…',
    });
  }, [setHeader]);

  return (
    <div className="rounded-xl border border-dashed border-blue-100 bg-white p-8 text-sm text-gray-600">
      Admin settings will appear here.
    </div>
  );
}
