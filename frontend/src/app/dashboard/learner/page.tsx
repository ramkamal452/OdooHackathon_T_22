'use client';

import CourseCard from '@/components/CourseCard';
import DashboardStats from '@/components/DashboardStats';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CourseListItem, api } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface LearnerDashboard {
  enrolled_courses?: number;
  in_progress?: number;
  completed?: number;
  total_points?: number;
  enrollments?: Array<{
    course_id: number;
    course_title: string;
    progress_percent?: number;
    status?: string;
  }>;
}

export default function LearnerDashboardPage() {
  const [data, setData] = useState<LearnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get<LearnerDashboard>('/api/dashboard/learner/');
      setData(d);
    } catch {
      setData({
        enrolled_courses: 0,
        in_progress: 0,
        completed: 0,
        total_points: 0,
        enrollments: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ProtectedRoute roles={['learner']}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#1e40af]">Learner dashboard</h1>
        <p className="mt-1 text-gray-600">Pick up where you left off.</p>

        {loading || !data ? (
          <div className="mt-12 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mt-8">
              <DashboardStats
                stats={[
                  {
                    label: 'Enrolled courses',
                    value: data.enrolled_courses ?? data.enrollments?.length ?? 0,
                  },
                  { label: 'In progress', value: data.in_progress ?? 0 },
                  { label: 'Completed', value: data.completed ?? 0 },
                  { label: 'Total points', value: data.total_points ?? 0 },
                ]}
              />
            </div>
            <h2 className="mt-12 text-xl font-semibold text-gray-900">Your courses</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(data.enrollments ?? []).map((en, idx) => {
                const courseObj: CourseListItem = {
                  id: en.course_id,
                  title: en.course_title,
                  short_description: '',
                };
                return (
                  <CourseCard
                    key={idx}
                    course={courseObj}
                    href={`/courses/${en.course_id}`}
                    progress={en.progress_percent}
                  />
                );
              })}
            </div>
            {(data.enrollments ?? []).length === 0 && (
              <p className="mt-8 text-center text-gray-500">
                You are not enrolled in any courses yet.{' '}
                <Link href="/courses" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
                  Browse courses
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
