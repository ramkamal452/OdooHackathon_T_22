'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useToast } from '@/components/Toast';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate, initialsFromName } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface EnrollmentRow {
  id: number;
  learner_name: string;
  learner_email: string;
  course_title: string;
  status: string;
  progress_percent: number;
  enrolled_at?: string;
}

const PAGE_SIZE = 10;

function DotsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export default function AdminEnrollmentsPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalActive: 0,
    completionRate: 0,
    dropped: 0,
    newThisMonth: 0,
  });
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Enrollment Registry',
      subtitle: 'Track learner enrollments and progress.',
      searchPlaceholder: 'Search by learner email or course title…',
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', { page: 1 });
        setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load courses';
        toast(msg, 'error');
      }
    })();
  }, [toast]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [active, completed, dropped, all] = await Promise.all([
        fetchPage<EnrollmentRow>('/api/admin/enrollments/', { page: 1, status: 'active', search }),
        fetchPage<EnrollmentRow>('/api/admin/enrollments/', { page: 1, status: 'completed', search }),
        fetchPage<EnrollmentRow>('/api/admin/enrollments/', { page: 1, status: 'dropped', search }),
        fetchPage<EnrollmentRow>('/api/admin/enrollments/', { page: 1, search }),
      ]);
      const denom = all.count || 1;
      const completionRate = Math.round((completed.count / denom) * 100);
      const newMonth = await countNewThisMonth(search);
      setStats({
        totalActive: active.count,
        completionRate,
        dropped: dropped.count,
        newThisMonth: newMonth,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load enrollment stats';
      toast(msg, 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [search, toast]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: EnrollmentRow[] }>(
        '/api/admin/enrollments/',
        {
          params: {
            page,
            search,
            status: status || undefined,
            course: courseId || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load enrollments';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, courseId, toast]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<EnrollmentRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#EN-{r.id}</span>,
    },
    {
      key: 'learner',
      header: 'Learner',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-600 dark:bg-blue-400/20 dark:text-blue-400">
            {(() => {
              const p = r.learner_name.trim().split(/\s+/);
              return initialsFromName(p[0], p[1] || '', r.learner_email);
            })()}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{r.learner_name}</p>
            <p className="text-xs text-gray-800 dark:text-gray-200">{r.learner_email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.course_title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled course</p>
        </div>
      ),
    },
    {
      key: 'enrolled_at',
      header: 'Enrolled At',
      render: (r) => formatDate(r.enrolled_at),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.status === 'active' ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            Active
          </span>
        ) : r.status === 'completed' ? (
          <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            Completed
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400">
            Dropped
          </span>
        ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
              style={{ width: `${r.progress_percent}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">{r.progress_percent}%</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <button type="button" className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300" aria-label="More">
          <DotsIcon />
        </button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Active" value={statsLoading ? '—' : stats.totalActive} />
        <StatsCard label="Completion Rate" value={statsLoading ? '—' : `${stats.completionRate}%`} />
        <StatsCard label="Dropped Students" value={statsLoading ? '—' : stats.dropped} />
        <StatsCard label="New This Month" value={statsLoading ? '—' : stats.newThisMonth} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</label>
          <select
            className="glass-input mt-1 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Course</label>
          <select
            className="glass-input mt-1 text-sm"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No enrollments found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="enrollments"
      />
    </div>
  );
}

async function countNewThisMonth(search?: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  let page = 1;
  let n = 0;
  while (true) {
    const data = await fetchPage<EnrollmentRow>('/api/admin/enrollments/', { page, search });
    for (const row of data.results) {
      if (row.enrolled_at && new Date(row.enrolled_at) >= start) n += 1;
    }
    if (!data.next) break;
    page += 1;
    if (page > 100) break;
  }
  return n;
}
