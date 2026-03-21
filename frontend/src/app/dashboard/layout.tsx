'use client';

import DashboardSidebar from '@/components/DashboardSidebar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute roles={['learner', 'instructor', 'admin']}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
