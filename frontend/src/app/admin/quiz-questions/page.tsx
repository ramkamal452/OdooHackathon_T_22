'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface QuestionRow {
  id: number;
  quiz_title: string;
  question_text: string;
  question_type?: string;
  marks?: number;
  sort_order: number;
}

const PAGE_SIZE = 10;

function DragHandle() {
  return (
    <span className="inline-flex cursor-grab text-gray-400 dark:text-gray-500" aria-hidden>
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm8-12a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </span>
  );
}

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

export default function AdminQuizQuestionsPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [quizTitle, setQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [health, setHealth] = useState(0);
  const [quizTitles, setQuizTitles] = useState<string[]>([]);

  const apiSearch = quizTitle || search;

  useEffect(() => {
    setHeader({
      title: 'Quiz Questions',
      subtitle: 'Question bank linked to assessments.',
      searchPlaceholder: 'Search question text or quiz…',
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ title: string }>('/api/quizzes/admin/list/', { page: 1 });
      const titles = Array.from(new Set(data.results.map((q) => q.title)));
      setQuizTitles(titles);
    })();
  }, []);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: QuestionRow[] }>(
        '/api/quizzes/admin/questions/',
        {
          params: { page, search: apiSearch },
        }
      );
      setRows(data.results);
      setTotal(data.count);
      setHealth(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, apiSearch]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<QuestionRow>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#Q-{r.id}</span>,
      },
      {
        key: 'quiz',
        header: 'Quiz Title',
        render: (r) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{r.quiz_title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assessment question</p>
          </div>
        ),
      },
      {
        key: 'question_text',
        header: 'Question Text',
        render: (r) => (
          <p className="max-w-md truncate text-gray-800 dark:text-gray-200">{r.question_text}</p>
        ),
      },
      {
        key: 'question_type',
        header: 'Type',
        render: (r) => (
          <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            {(r.question_type || 'mcq').toUpperCase()}
          </span>
        ),
      },
      {
        key: 'marks',
        header: 'Marks',
        render: (r) => <span className="tabular-nums">{r.marks ?? '—'}</span>,
      },
      {
        key: 'sort_order',
        header: 'Sort Order',
        render: (r) => (
          <div className="flex items-center gap-2">
            <DragHandle />
            <span className="tabular-nums">{r.sort_order}</span>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: () => (
          <button type="button" className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-blue-400" aria-label="Edit">
            <PencilIcon />
          </button>
        ),
      },
    ],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Quiz</label>
            <select
              className="glass-input mt-1 text-sm"
              value={quizTitle}
              onChange={(e) => {
                setQuizTitle(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All (use header search)</option>
              {quizTitles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No questions found." />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemName="questions"
        />
      </div>
      <aside className="glass-card h-fit border border-dashed border-blue-200/50 p-6 dark:border-blue-500/20">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Database Health</p>
        <p className="mt-2 text-3xl font-semibold text-blue-600 dark:text-blue-400">{loading ? '—' : health}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total questions indexed</p>
      </aside>
    </div>
  );
}
