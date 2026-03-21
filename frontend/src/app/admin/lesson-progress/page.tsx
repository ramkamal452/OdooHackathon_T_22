'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDateTime, initialsFromName } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface ProgressRow {
  id: number;
  learner_name: string;
  learner_email: string;
  lesson_title: string;
  course_title: string;
  is_completed: boolean;
  completed_at?: string | null;
  last_viewed_at?: string | null;
}

const PAGE_SIZE = 10;

function DotsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export default function AdminLessonProgressPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'all' | 'completed' | 'not'>('all');
  const [dateRange, setDateRange] = useState('any');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    stalled: 0,
  });

  const isCompletedParam =
    tab === 'completed' ? true : tab === 'not' ? false : undefined;

  useEffect(() => {
    setHeader({
      title: 'Lesson Progress',
      subtitle: 'Monitor completion across lessons.',
      searchPlaceholder: 'Search by learner or lesson…',
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    });
  }, [setHeader]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, done, notDone] = await Promise.all([
        fetchPage<ProgressRow>('/api/admin/lesson-progress/', { page: 1, search }),
        fetchPage<ProgressRow>('/api/admin/lesson-progress/', {
          page: 1,
          search,
          is_completed: true,
        }),
        fetchPage<ProgressRow>('/api/admin/lesson-progress/', {
          page: 1,
          search,
          is_completed: false,
        }),
      ]);
      const stalled = await countStalled(search);
      const inProg = Math.max(0, notDone.count - stalled);
      setStats({
        total: all.count,
        completed: done.count,
        inProgress: inProg,
        stalled,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: ProgressRow[] }>(
        '/api/admin/lesson-progress/',
        {
          params: {
            page,
            search,
            is_completed:
              isCompletedParam === undefined ? undefined : isCompletedParam ? 'true' : 'false',
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, isCompletedParam]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<ProgressRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">LP-{r.id}</span>,
    },
    {
      key: 'learner',
      header: 'Learner Name',
      render: (r) => {
        const p = r.learner_name.trim().split(/\s+/);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-600 dark:bg-blue-400/20 dark:text-blue-400">
              {initialsFromName(p[0], p[1] || '', r.learner_email)}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{r.learner_name}</p>
              <p className="text-xs text-gray-800 dark:text-gray-200">{r.learner_email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'lesson',
      header: 'Lesson Title',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.lesson_title}</p>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{r.course_title}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.is_completed ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            COMPLETED
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:border-gray-400/10 dark:bg-gray-400/10 dark:text-gray-400">
            NOT COMPLETED
          </span>
        ),
    },
    {
      key: 'completed_at',
      header: 'Completed At',
      render: (r) => formatDateTime(r.completed_at),
    },
    {
      key: 'last_viewed_at',
      header: 'Last Viewed At',
      render: (r) => formatDateTime(r.last_viewed_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <button type="button" className="rounded p-1 text-gray-400 hover:bg-white/10 dark:hover:text-gray-300" aria-label="More">
          <DotsIcon />
        </button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Lessons" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Completed" value={statsLoading ? '—' : stats.completed} />
        <StatsCard label="In Progress" value={statsLoading ? '—' : stats.inProgress} />
        <StatsCard label="Stalled" value={statsLoading ? '—' : stats.stalled} variant="warning" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/20 bg-white/70 p-1 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
          {(
            [
              ['all', 'All'],
              ['completed', 'Completed'],
              ['not', 'Not Completed'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setPage(1);
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                tab === k ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500' : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Date Range
          </label>
          <select
            className="glass-input mt-1 text-sm"
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
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No progress rows found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="records"
      />
    </div>
  );
}

async function countStalled(search?: string): Promise<number> {
  let page = 1;
  let n = 0;
  const week = Date.now() - 7 * 86400000;
  while (true) {
    const data = await fetchPage<ProgressRow>('/api/admin/lesson-progress/', {
      page,
      search,
      is_completed: false,
    });
    for (const r of data.results) {
      const t = r.last_viewed_at ? new Date(r.last_viewed_at).getTime() : 0;
      if (t && t < week) n += 1;
    }
    if (!data.next) break;
    page += 1;
    if (page > 80) break;
  }
  return n;
}
