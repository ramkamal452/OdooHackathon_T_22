'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDateTime, initialsFromName } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface AttemptRow {
  id: number;
  learner_name: string;
  learner_email: string;
  quiz_title: string;
  score: number;
  total_marks: number;
  percentage: number;
  is_passed: boolean;
  started_at?: string;
  submitted_at?: string | null;
}

const PAGE_SIZE = 10;

export default function AdminQuizAttemptsPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [quizId, setQuizId] = useState('');
  const [passed, setPassed] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: 0,
    passing: 0,
    failed: 0,
  });
  const [quizzes, setQuizzes] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Quiz Attempts',
      subtitle: 'Scores and outcomes for each learner attempt.',
      searchPlaceholder: 'Search by learner email or quiz…',
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/quizzes/admin/list/', {
        page: 1,
      });
      setQuizzes(data.results.map((q) => ({ id: q.id, title: q.title })));
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, ok, bad, agg] = await Promise.all([
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page: 1, search }),
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', {
          page: 1,
          search,
          is_passed: true,
        }),
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', {
          page: 1,
          search,
          is_passed: false,
        }),
        aggregateAttempts(search),
      ]);
      setStats({
        total: all.count,
        avgScore: agg.avgPct,
        passing: ok.count,
        failed: bad.count,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: AttemptRow[] }>(
        '/api/quizzes/admin/attempts/',
        {
          params: {
            page,
            search,
            quiz: quizId || undefined,
            is_passed:
              passed === 'passed' ? true : passed === 'failed' ? false : undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, quizId, passed]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<AttemptRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#QA-{r.id}</span>,
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
            <span className="font-medium text-gray-900 dark:text-white">{r.learner_name}</span>
          </div>
        );
      },
    },
    { key: 'quiz_title', header: 'Quiz Title', render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.quiz_title}</span> },
    {
      key: 'score',
      header: 'Score',
      render: (r) => (
        <span className="tabular-nums">
          {r.score} / {r.total_marks}
        </span>
      ),
    },
    {
      key: 'pct',
      header: 'Percentage',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
              style={{ width: `${Math.min(100, r.percentage)}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">{r.percentage}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.is_passed ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            PASSED
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400">
            FAILED
          </span>
        ),
    },
    {
      key: 'started_at',
      header: 'Started At',
      render: (r) => formatDateTime(r.started_at),
    },
    {
      key: 'submitted_at',
      header: 'Submitted At',
      render: (r) => formatDateTime(r.submitted_at),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Attempts" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Avg. Score" value={statsLoading ? '—' : `${stats.avgScore}%`} />
        <StatsCard label="Passing Grade" value={statsLoading ? '—' : stats.passing} />
        <StatsCard label="Failed Attempts" value={statsLoading ? '—' : stats.failed} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Quiz</label>
          <select
            className="glass-input mt-1 text-sm"
            value={quizId}
            onChange={(e) => {
              setQuizId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</label>
          <select
            className="glass-input mt-1 text-sm"
            value={passed}
            onChange={(e) => {
              setPassed(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuizId('');
            setPassed('');
            setPage(1);
          }}
          className="btn-secondary px-4 py-2 text-sm font-medium shadow-sm"
        >
          Reset Filters
        </button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No attempts found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="attempts"
      />
    </div>
  );
}

async function aggregateAttempts(search?: string) {
  let page = 1;
  let sum = 0;
  let n = 0;
  while (true) {
    const data = await fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page, search });
    for (const a of data.results) {
      sum += a.percentage ?? 0;
      n += 1;
    }
    if (!data.next) break;
    page += 1;
    if (page > 80) break;
  }
  return { avgPct: n ? Math.round(sum / n) : 0 };
}
