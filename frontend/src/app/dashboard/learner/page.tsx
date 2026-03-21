'use client';

import CourseCard from '@/components/CourseCard';
import DashboardStats from '@/components/DashboardStats';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Badge, CourseListItem, PointLedgerEntry, api, unwrapList } from '@/lib/api';
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
  const [badges, setBadges] = useState<{ badge: Badge; awarded_at: string }[]>([]);
  const [points, setPoints] = useState<PointLedgerEntry[]>([]);
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
    }
    try {
      const { data: b } = await api.get<unknown>('/api/my/badges/');
      setBadges(unwrapList(b));
    } catch {
      setBadges([]);
    }
    try {
      const { data: p } = await api.get<unknown>('/api/my/points/');
      setPoints(unwrapList<PointLedgerEntry>(p));
    } catch {
      setPoints([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ProtectedRoute roles={['learner']}>
      <div className="min-h-screen surface-bg">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Learner dashboard
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Pick up where you left off.</p>

          {loading || !data ? (
            <div className="mt-12 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent" />
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

              {badges.length > 0 && (
                <>
                  <h2 className="mt-12 text-xl font-semibold text-gray-900 dark:text-white">
                    Your badges
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {badges.map((b) => (
                      <div
                        key={b.badge.id}
                        className="glass-card flex items-center gap-3 rounded-xl px-4 py-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-lg font-bold text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
                          {b.badge.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{b.badge.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{b.badge.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {points.length > 0 && (
                <>
                  <h2 className="mt-12 text-xl font-semibold text-gray-900 dark:text-white">
                    Recent point activity
                  </h2>
                  <div className="glass-card mt-4 divide-y divide-white/10 rounded-xl dark:divide-white/5">
                    {points.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.reason || p.source_type_label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(p.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${p.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {p.points >= 0 ? '+' : ''}{p.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h2 className="mt-12 text-xl font-semibold text-gray-900 dark:text-white">
                Your courses
              </h2>
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
                <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
                  You are not enrolled in any courses yet.{' '}
                  <Link
                    href="/courses"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Browse courses
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
