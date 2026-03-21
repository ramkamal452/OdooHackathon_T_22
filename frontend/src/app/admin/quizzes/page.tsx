'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useToast } from '@/components/Toast';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api, unwrapList } from '@/lib/api';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
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

function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'detail' in data && typeof (data as { detail: unknown }).detail === 'string') {
      return (data as { detail: string }).detail;
    }
    if (data && typeof data === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
        else if (v && typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
        else parts.push(`${k}: ${String(v)}`);
      }
      if (parts.length) return parts.join(' ');
    }
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
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
  const router = useRouter();
  const { toast } = useToast();
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

  const [modalOpen, setModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [modalCourses, setModalCourses] = useState<{ id: number; title: string }[]>([]);
  const [createCourseId, setCreateCourseId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPassPct, setCreatePassPct] = useState('70');
  const [createQuestionText, setCreateQuestionText] = useState('');
  const [createOpt0, setCreateOpt0] = useState('');
  const [createOpt1, setCreateOpt1] = useState('');
  const [createCorrectIndex, setCreateCorrectIndex] = useState(0);

  useEffect(() => {
    setHeader({
      title: 'Assessment Library',
      subtitle: 'Quizzes, pass rates, and publish state.',
      searchPlaceholder: 'Search quizzes or courses…',
      primaryActionLabel: '+ New Quiz',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', { page: 1 });
      setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<unknown>('/api/courses/');
        setModalCourses(unwrapList<{ id: number; title: string }>(data));
      } catch {
        setModalCourses([]);
      }
    })();
  }, []);

  const resetCreateForm = useCallback(() => {
    setCreateCourseId('');
    setCreateTitle('');
    setCreateDescription('');
    setCreatePassPct('70');
    setCreateQuestionText('');
    setCreateOpt0('');
    setCreateOpt1('');
    setCreateCorrectIndex(0);
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

  const handleEditQuiz = useCallback(
    async (quizId: number) => {
      try {
        const { data } = await api.get<{ course: { id: number } }>(`/api/quizzes/${quizId}/`);
        const cid = data.course?.id;
        if (cid != null) {
          router.push(`/dashboard/instructor/courses/${cid}/edit`);
          toast('Opening course editor…', 'info');
        } else {
          toast('Could not resolve course for this quiz.', 'error');
        }
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    },
    [router, toast]
  );

  const handleCopyQuizLink = useCallback(
    async (quizId: number) => {
      try {
        const { data } = await api.get<{ course: { id: number } }>(`/api/quizzes/${quizId}/`);
        const cid = data.course?.id;
        if (cid == null) {
          toast('Could not resolve course for this quiz.', 'error');
          return;
        }
        const path = `/courses/${cid}/quiz/${quizId}`;
        const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
        await navigator.clipboard.writeText(url);
        toast('Quiz link copied to clipboard.', 'success');
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    },
    [toast]
  );

  const handleDeleteQuiz = useCallback(
    async (quizId: number) => {
      if (!confirm('Delete this quiz? This cannot be undone.')) return;
      try {
        await api.delete(`/api/quizzes/${quizId}/`);
        toast('Quiz deleted.', 'success');
        await loadTable();
        await loadStats();
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    },
    [loadTable, loadStats, toast]
  );

  const handleCreateQuiz = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cid = Number(createCourseId);
      if (!cid) {
        toast('Please select a course.', 'error');
        return;
      }
      const title = createTitle.trim();
      if (!title) {
        toast('Title is required.', 'error');
        return;
      }
      const qText = createQuestionText.trim();
      if (!qText) {
        toast('Question text is required.', 'error');
        return;
      }
      const o0 = createOpt0.trim();
      const o1 = createOpt1.trim();
      if (!o0 || !o1) {
        toast('Both answer options are required.', 'error');
        return;
      }
      const passPct = Math.min(100, Math.max(0, Number(createPassPct) || 70));
      setCreateSubmitting(true);
      try {
        await api.post(`/api/quizzes/course/${cid}/`, {
          title,
          description: createDescription.trim(),
          pass_percentage: passPct,
          is_published: false,
          questions: [
            {
              question_text: qText,
              marks: 1,
              sort_order: 0,
              options: [
                { option_text: o0, is_correct: createCorrectIndex === 0 },
                { option_text: o1, is_correct: createCorrectIndex === 1 },
              ],
            },
          ],
        });
        toast('Quiz created.', 'success');
        setModalOpen(false);
        resetCreateForm();
        await loadTable();
        await loadStats();
      } catch (err) {
        toast(errorMessage(err), 'error');
      } finally {
        setCreateSubmitting(false);
      }
    },
    [
      createCourseId,
      createTitle,
      createDescription,
      createPassPct,
      createQuestionText,
      createOpt0,
      createOpt1,
      createCorrectIndex,
      loadTable,
      loadStats,
      resetCreateForm,
      toast,
    ]
  );

  const columns: Column<QuizRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#QZ-{r.id}</span>,
    },
    {
      key: 'ctx',
      header: 'Course / Module',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{r.course_title}</p>
          {r.module_title ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Module: {r.module_title}</p>
          ) : null}
        </div>
      ),
    },
    { key: 'title', header: 'Quiz Title', render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.title}</span> },
    {
      key: 'pass',
      header: 'Pass %',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
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
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            PUBLISHED
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:border-gray-400/10 dark:bg-gray-400/10 dark:text-gray-400">
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
      render: (r) => (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10 hover:text-blue-600 dark:hover:bg-white/10 dark:hover:text-blue-400"
            aria-label="Edit"
            onClick={() => handleEditQuiz(r.id)}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10 hover:text-blue-600 dark:hover:bg-white/10 dark:hover:text-blue-400"
            aria-label="Copy quiz link"
            onClick={() => handleCopyQuizLink(r.id)}
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10 hover:text-rose-600 dark:hover:text-rose-400"
            aria-label="Delete"
            onClick={() => handleDeleteQuiz(r.id)}
          >
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetCreateForm();
        }}
        title="New quiz"
        subtitle="Create a quiz with a starter question. You can add more on the course edit page."
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleCreateQuiz}>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Course *</label>
            <select
              className="glass-input mt-1 w-full text-sm"
              required
              value={createCourseId}
              onChange={(e) => setCreateCourseId(e.target.value)}
            >
              <option value="">Select a course</option>
              {modalCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Title *</label>
            <input
              type="text"
              className="glass-input mt-1 w-full text-sm"
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Quiz title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Description</label>
            <textarea
              className="glass-input mt-1 min-h-[72px] w-full resize-y text-sm"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Pass percentage</label>
            <input
              type="number"
              min={0}
              max={100}
              className="glass-input mt-1 w-full text-sm"
              value={createPassPct}
              onChange={(e) => setCreatePassPct(e.target.value)}
            />
          </div>
          <div className="border-t border-gray-100 pt-4 dark:border-white/10">
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Starter question</p>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Question text *</label>
            <textarea
              className="glass-input mt-1 min-h-[64px] w-full resize-y text-sm"
              required
              value={createQuestionText}
              onChange={(e) => setCreateQuestionText(e.target.value)}
              placeholder="Your first question"
            />
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="glass-input min-w-[200px] flex-1 text-sm"
                  value={createOpt0}
                  onChange={(e) => setCreateOpt0(e.target.value)}
                  placeholder="Option A"
                  aria-label="Option A"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="correct-opt"
                    checked={createCorrectIndex === 0}
                    onChange={() => setCreateCorrectIndex(0)}
                  />
                  Correct
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="glass-input min-w-[200px] flex-1 text-sm"
                  value={createOpt1}
                  onChange={(e) => setCreateOpt1(e.target.value)}
                  placeholder="Option B"
                  aria-label="Option B"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="correct-opt"
                    checked={createCorrectIndex === 1}
                    onChange={() => setCreateCorrectIndex(1)}
                  />
                  Correct
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm font-medium"
              onClick={() => {
                setModalOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium" disabled={createSubmitting}>
              {createSubmitting ? 'Creating…' : 'Create quiz'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Quizzes" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Avg. Pass Rate" value={statsLoading ? '—' : `${stats.avgPass}%`} />
        <StatsCard label="Urgent Reviews" value={statsLoading ? '—' : stats.urgent} variant="warning" />
        <StatsCard label="Active Attempts" value={statsLoading ? '—' : stats.activeAttempts} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
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
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Date Range</label>
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
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm font-medium shadow-sm"
            onClick={() => loadTable()}
          >
            Newest
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm font-medium shadow-sm"
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
