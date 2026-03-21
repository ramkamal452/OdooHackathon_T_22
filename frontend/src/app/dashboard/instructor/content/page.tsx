'use client';
import ContentManager from '@/components/ContentManager';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function ContentManagerPage() {
  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="min-h-screen surface-bg">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/dashboard/instructor" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                &larr; Dashboard
              </Link>
              <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Content Manager</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create and manage courses, modules, lessons, quizzes, videos, and resources — in any hierarchy.
              </p>
            </div>
          </div>
          <ContentManager />
        </div>
      </div>
    </ProtectedRoute>
  );
}
