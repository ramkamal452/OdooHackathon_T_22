'use client';

import AdminHeader from '@/components/AdminHeader';
import AdminSidebar from '@/components/AdminSidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AdminPageProvider, useAdminPage } from '@/app/admin/AdminPageContext';

function AdminChrome({ children }: { children: React.ReactNode }) {
  const { search, setSearch, header } = useAdminPage();
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={header.searchPlaceholder}
          title={header.title}
          subtitle={header.subtitle}
          primaryActionLabel={header.primaryActionLabel}
          onPrimaryAction={header.onPrimaryAction}
        />
        <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminPageProvider>
        <AdminChrome>{children}</AdminChrome>
      </AdminPageProvider>
    </ProtectedRoute>
  );
}
