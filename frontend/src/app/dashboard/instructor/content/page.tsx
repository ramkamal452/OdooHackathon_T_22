'use client';

import ContentManager from '@/components/ContentManager';
import DashboardHeader from '@/components/DashboardHeader';

export default function ContentManagerPage() {
  return (
    <>
      <DashboardHeader
        title="Content Manager"
        subtitle="Create and manage courses, modules, lessons, quizzes, videos, and resources."
      />
      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        <ContentManager />
      </div>
    </>
  );
}
