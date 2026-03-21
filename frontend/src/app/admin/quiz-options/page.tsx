'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface OptionRow {
  id: number;
  question_text_preview: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
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

export default function AdminQuizOptionsPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [questionId, setQuestionId] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [questions, setQuestions] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Quiz Options',
      subtitle: 'Answer options and correctness flags.',
      searchPlaceholder: 'Search option text…',
      primaryActionLabel: undefined,
      onPrimaryAction: undefined,
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; question_text: string }>(
        '/api/quizzes/admin/questions/',
        { page: 1 }
      );
      setQuestions(
        data.results.map((q) => ({
          id: q.id,
          label: q.question_text.length > 60 ? `${q.question_text.slice(0, 60)}…` : q.question_text,
        }))
      );
    })();
  }, []);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: OptionRow[] }>(
        '/api/quizzes/admin/options/',
        {
          params: {
            page,
            search,
            question: questionId || undefined,
          },
        }
      );
      const list = [...data.results].sort((a, b) =>
        sortAsc ? a.sort_order - b.sort_order : b.sort_order - a.sort_order
      );
      setRows(list);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, questionId, sortAsc]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<OptionRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#OPT-{r.id}</span>,
    },
    {
      key: 'question',
      header: 'Linked Question',
      render: (r) => (
        <div>
          <p className="max-w-sm text-sm text-gray-900 dark:text-white">{r.question_text_preview}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Quiz module context</p>
        </div>
      ),
    },
    {
      key: 'option_text',
      header: 'Option Content',
      render: (r) => (
        <div className="max-w-md rounded-lg border border-white/20 bg-white/50 px-3 py-2 text-sm text-gray-800 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
          {r.option_text}
        </div>
      ),
    },
    {
      key: 'is_correct',
      header: 'Status',
      render: (r) =>
        r.is_correct ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            CORRECT
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400">
            <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            INCORRECT
          </span>
        ),
    },
    {
      key: 'sort_order',
      header: 'Order',
      render: (r) => <span className="tabular-nums">{r.sort_order}</span>,
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
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Question</label>
          <select
            className="glass-input mt-1 max-w-xs text-sm"
            value={questionId}
            onChange={(e) => {
              setQuestionId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Sort Order</span>
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              sortAsc
                ? 'border-blue-500/20 bg-blue-500/10 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300'
                : 'border-white/20 bg-white/50 text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-300'
            }`}
          >
            {sortAsc ? 'Ascending' : 'Descending'}
          </button>
        </div>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No options found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="options"
      />
    </div>
  );
}
