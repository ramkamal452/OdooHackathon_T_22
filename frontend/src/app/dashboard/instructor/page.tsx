'use client';

import DashboardStats from '@/components/DashboardStats';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface InstructorRow {
  id: number;
  title: string;
  status?: string;
  is_published?: boolean;
  enrollment_count?: number;
  enrollments_count?: number;
}

interface InstructorDashboard {
  total_courses: number;
  total_enrollments: number;
  total_completed: number;
  total_in_progress?: number;
  in_progress?: number;
  courses: InstructorRow[];
}

export default function InstructorDashboardPage() {
  const [data, setData] = useState<InstructorDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get<InstructorDashboard>('/api/dashboard/instructor/');
      setData(d);
    } catch {
      setData({
        total_courses: 0,
        total_enrollments: 0,
        total_completed: 0,
        courses: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1e40af]">Instructor dashboard</h1>
            <p className="mt-1 text-gray-600">Manage your courses and track enrollments.</p>
          </div>
          <Link
            href="/dashboard/instructor/courses/new"
            className="inline-flex justify-center rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Create course
          </Link>
        </div>

        {loading || !data ? (
          <div className="mt-12 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mt-8">
              <DashboardStats
                stats={[
                  { label: 'Total courses', value: data.total_courses },
                  { label: 'Total enrollments', value: data.total_enrollments },
                  { label: 'Completed', value: data.total_completed },
                  {
                    label: 'In progress',
                    value:
                      data.total_in_progress ??
                      data.in_progress ??
                      Math.max(
                        0,
                        data.total_enrollments - data.total_completed
                      ),
                  },
                ]}
              />
            </div>

            <div className="mt-12 overflow-hidden rounded-xl border border-dashed border-blue-100 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-blue-100">
                <thead className="bg-blue-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Enrollments
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {data.courses.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.status === 'published' || c.is_published ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Published
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {c.enrollment_count ?? c.enrollments_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/instructor/courses/${c.id}/edit`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.courses.length === 0 && (
                <p className="p-8 text-center text-sm text-gray-500">
                  No courses yet. Create your first course to get started.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
