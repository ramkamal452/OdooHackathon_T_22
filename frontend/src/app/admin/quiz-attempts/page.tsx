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
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
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
      render: (r) => <span className="font-mono text-gray-700">#QA-{r.id}</span>,
    },
    {
      key: 'learner',
      header: 'Learner Name',
      render: (r) => {
        const p = r.learner_name.trim().split(/\s+/);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {initialsFromName(p[0], p[1] || '', r.learner_email)}
            </div>
            <span className="font-medium text-gray-900">{r.learner_name}</span>
          </div>
        );
      },
    },
    { key: 'quiz_title', header: 'Quiz Title', render: (r) => <span className="font-medium">{r.quiz_title}</span> },
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
          <div className="h-1.5 w-20 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600"
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
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            PASSED
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
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
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Quiz</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Status</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
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
