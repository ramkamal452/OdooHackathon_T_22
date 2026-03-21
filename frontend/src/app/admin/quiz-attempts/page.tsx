'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
const ALL_QUIZZES = '__all__';
const ALL_STATUS = '__all__';

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

  const passedSelectValue =
    passed === '' ? ALL_STATUS : passed === 'passed' ? 'passed' : passed === 'failed' ? 'failed' : ALL_STATUS;

  const columns: Column<AttemptRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-muted-foreground">#QA-{r.id}</span>,
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
            <span className="font-medium text-foreground">{r.learner_name}</span>
          </div>
        );
      },
    },
    { key: 'quiz_title', header: 'Quiz Title', render: (r) => <span className="font-medium text-foreground">{r.quiz_title}</span> },
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
          <div className="h-1.5 w-20 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
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
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400"
          >
            PASSED
          </Badge>
        ) : (
          <Badge variant="destructive" className="font-bold">
            FAILED
          </Badge>
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
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</Label>
          <Select
            value={quizId || ALL_QUIZZES}
            onValueChange={(v) => {
              const s = v ?? '';
              setQuizId(s === ALL_QUIZZES ? '' : s);
              setPage(1);
            }}
          >
            <SelectTrigger className="mt-1 w-[220px]">
              <SelectValue placeholder="All quizzes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUIZZES}>All</SelectItem>
              {quizzes.map((q) => (
                <SelectItem key={q.id} value={String(q.id)}>
                  {q.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
          <Select
            value={passedSelectValue}
            onValueChange={(v) => {
              const s = v ?? ALL_STATUS;
              if (s === ALL_STATUS) setPassed('');
              else if (s === 'passed') setPassed('passed');
              else if (s === 'failed') setPassed('failed');
              setPage(1);
            }}
          >
            <SelectTrigger className="mt-1 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setQuizId('');
            setPassed('');
            setPage(1);
          }}
        >
          Reset Filters
        </Button>
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
