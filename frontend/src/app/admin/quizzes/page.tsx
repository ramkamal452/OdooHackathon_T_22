'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface QuizRow {
  id: number;
  title: string;
  course_title: string;
  module_title?: string | null;
  pass_percentage: number;
  is_published: boolean;
  question_count?: number;
  created_at?: string;
}

const PAGE_SIZE = 10;

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export default function AdminQuizzesPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [dateRange, setDateRange] = useState('any');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    avgPass: 0,
    urgent: 0,
    activeAttempts: 0,
  });
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Assessment Library',
      subtitle: 'Quizzes, pass rates, and publish state.',
      searchPlaceholder: 'Search quizzes or courses…',
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', { page: 1 });
      setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, attempts] = await Promise.all([
        fetchPage<QuizRow>('/api/quizzes/admin/list/', { page: 1, search }),
        fetchPage<{ id: number }>('/api/quizzes/admin/attempts/', { page: 1, search }),
      ]);
      const agg = await aggregateQuizStats(search);
      setStats({
        total: all.count,
        avgPass: agg.avgPass,
        urgent: agg.urgent,
        activeAttempts: attempts.count,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: QuizRow[] }>(
        '/api/quizzes/admin/list/',
        {
          params: {
            page,
            search,
            course: courseId || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, courseId, dateRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<QuizRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">#QZ-{r.id}</span>,
    },
    {
      key: 'ctx',
      header: 'Course / Module',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.course_title}</p>
          {r.module_title ? (
            <p className="text-xs text-gray-500">Module: {r.module_title}</p>
          ) : null}
        </div>
      ),
    },
    { key: 'title', header: 'Quiz Title', render: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: 'pass',
      header: 'Pass %',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${r.pass_percentage}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">{r.pass_percentage}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.is_published ? (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            PUBLISHED
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
            DRAFT
          </span>
        ),
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (r) => formatDate(r.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <div className="flex items-center gap-2 text-gray-500">
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-blue-600" aria-label="Edit">
            <PencilIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-blue-600" aria-label="Copy">
            <CopyIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-rose-600" aria-label="Delete">
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Quizzes" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Avg. Pass Rate" value={statsLoading ? '—' : `${stats.avgPass}%`} />
        <StatsCard label="Urgent Reviews" value={statsLoading ? '—' : stats.urgent} variant="warning" />
        <StatsCard label="Active Attempts" value={statsLoading ? '—' : stats.activeAttempts} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Course</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Date Range</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
          >
            <option value="any">Any</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            onClick={() => loadTable()}
          >
            Newest
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            onClick={() => loadTable()}
          >
            Pass %
          </button>
        </div>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No quizzes found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="quizzes"
      />
    </div>
  );
}

async function aggregateQuizStats(search?: string) {
  let page = 1;
  let sum = 0;
  let n = 0;
  let urgent = 0;
  while (true) {
    const data = await fetchPage<QuizRow>('/api/quizzes/admin/list/', { page, search });
    for (const q of data.results) {
      sum += q.pass_percentage ?? 0;
      n += 1;
      if (!q.is_published && (q.question_count ?? 0) > 0) urgent += 1;
    }
    if (!data.next) break;
    page += 1;
    if (page > 100) break;
  }
  return { avgPass: n ? Math.round(sum / n) : 0, urgent };
}
