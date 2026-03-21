'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface AnswerRow {
  id: number;
  attempt_id: number;
  question_text_preview: string;
  selected_option_text: string;
  is_correct: boolean;
  marks_awarded: number;
}

const PAGE_SIZE = 10;

function DotsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export default function AdminQuizAnswersPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [attemptId, setAttemptId] = useState('');
  const [view, setView] = useState<'table' | 'analytics'>('table');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AnswerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    correctRate: 0,
    avgErrors: 0,
    total: 0,
  });
  const [attempts, setAttempts] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Quiz Answers Tracking',
      subtitle: 'Per-question responses linked to attempts.',
      searchPlaceholder: 'Search question text…',
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; quiz_title: string }>(
        '/api/quizzes/admin/attempts/',
        { page: 1 }
      );
      setAttempts(
        data.results.map((a) => ({
          id: a.id,
          label: `ATT-${a.id} · ${a.quiz_title}`,
        }))
      );
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const agg = await aggregateAnswers(search);
      setStats(agg);
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: AnswerRow[] }>(
        '/api/quizzes/admin/answers/',
        {
          params: {
            page,
            search,
            attempt: attemptId || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, attemptId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<AnswerRow>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">ANS-{r.id}</span>,
      },
      {
        key: 'attempt',
        header: 'Attempt ID',
        render: (r) => (
          <span className="inline-flex rounded-md border border-white/20 bg-white/50 px-2 py-0.5 font-mono text-xs text-gray-800 dark:border-white/10 dark:bg-white/10 dark:text-gray-200">
            ATT-{r.attempt_id}
          </span>
        ),
      },
      {
        key: 'question',
        header: 'Question',
        render: (r) => (
          <div>
            <p className="max-w-sm truncate text-gray-900 dark:text-white">{r.question_text_preview}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Course assessment</p>
          </div>
        ),
      },
      {
        key: 'selected',
        header: 'Selected Option',
        render: (r) => <span className="text-gray-800 dark:text-gray-200">{r.selected_option_text}</span>,
      },
      {
        key: 'correct',
        header: 'Correct',
        render: (r) =>
          r.is_correct ? (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
              <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              YES
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400">
              <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              NO
            </span>
          ),
      },
      {
        key: 'marks',
        header: 'Marks',
        render: (r) => (
          <span className="tabular-nums">
            {r.marks_awarded} / —
          </span>
        ),
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
    ],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    const header = [
      'id',
      'attempt_id',
      'question',
      'selected_option',
      'is_correct',
      'marks_awarded',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.attempt_id,
          JSON.stringify(r.question_text_preview),
          JSON.stringify(r.selected_option_text),
          r.is_correct,
          r.marks_awarded,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-answers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const correctN = rows.filter((r) => r.is_correct).length;
  const wrongN = rows.filter((r) => !r.is_correct).length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Correct Rate"
          value={statsLoading ? '—' : `${stats.correctRate}%`}
        />
        <StatsCard label="Average Errors" value={statsLoading ? '—' : stats.avgErrors} />
        <StatsCard label="Avg Response Time" value="—" />
        <StatsCard label="Total Responses" value={statsLoading ? '—' : stats.total} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Attempt</label>
            <select
              className="glass-input mt-1 max-w-xs text-sm"
              value={attemptId}
              onChange={(e) => {
                setAttemptId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {attempts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</label>
            <select
              className="glass-input mt-1 text-sm"
              defaultValue=""
              disabled
              title="Requires API filter for is_correct"
            >
              <option value="">All</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
            </select>
          </div>
          <button
            type="button"
            className="rounded-lg border border-dashed border-gray-300/80 px-4 py-2 text-sm text-gray-600 dark:border-white/20 dark:text-gray-400"
          >
            More Filters
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="btn-secondary px-4 py-2 text-sm font-medium text-gray-800 shadow-sm dark:text-gray-200"
          >
            Export CSV
          </button>
        </div>
        <div className="flex rounded-xl border border-white/20 bg-white/70 p-1 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              view === 'table' ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-white/10'
            }`}
          >
            Table View
          </button>
          <button
            type="button"
            onClick={() => setView('analytics')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              view === 'analytics' ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-white/10'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>
      {view === 'analytics' ? (
        <div className="glass-card rounded-2xl border border-dashed border-blue-200/50 p-8 dark:border-blue-500/20">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Response mix (current page)</p>
          <div className="mt-6 flex h-40 items-end gap-8">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 rounded-t bg-emerald-500 dark:bg-emerald-400"
                style={{ height: `${Math.max(8, (correctN / Math.max(1, correctN + wrongN)) * 160)}px` }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Correct ({correctN})</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 rounded-t bg-rose-400 dark:bg-rose-500"
                style={{ height: `${Math.max(8, (wrongN / Math.max(1, correctN + wrongN)) * 160)}px` }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Incorrect ({wrongN})</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No answers found." />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemName="responses"
          />
        </>
      )}
    </div>
  );
}

async function aggregateAnswers(search?: string) {
  let page = 1;
  let correct = 0;
  let total = 0;
  while (true) {
    const data = await fetchPage<AnswerRow>('/api/quizzes/admin/answers/', { page, search });
    for (const r of data.results) {
      total += 1;
      if (r.is_correct) correct += 1;
    }
    if (!data.next) break;
    page += 1;
    if (page > 100) break;
  }
  const correctRate = total ? Math.round((correct / total) * 100) : 0;
  const avgErrors = total ? Math.round(((total - correct) / total) * 100) / 100 : 0;
  return { correctRate, avgErrors, total };
}
