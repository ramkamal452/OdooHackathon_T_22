'use client';

import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useToast } from '@/components/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate, formatDateTime, initialsFromName } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api, unwrapList } from '@/lib/api';
import { isAxiosError } from 'axios';
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Edit,
  FileQuestion,
  GripVertical,
  MoreVertical,
  Pencil,
  Percent,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

/* ================================================================
   Types
   ================================================================ */

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

interface QuestionRow {
  id: number;
  quiz_title: string;
  question_text: string;
  question_type?: string;
  marks?: number;
  sort_order: number;
}

interface OptionRow {
  id: number;
  question_text_preview: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

interface AnswerRow {
  id: number;
  attempt_id: number;
  question_text_preview: string;
  selected_option_text: string;
  is_correct: boolean;
  marks_awarded: number;
}

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
const SELECT_NONE = '__none__';
const SELECT_ALL = '__all__';

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

/* ================================================================
   Main Page
   ================================================================ */

export default function AdminQuizzesPage() {
  const { toast } = useToast();
  const { setHeader, search } = useAdminPage();
  const [activeTab, setActiveTab] = useState('quizzes');

  useEffect(() => {
    setHeader({
      title: 'Assessment Center',
      subtitle: 'Quizzes, questions, answers, and attempts — all in one place.',
      searchPlaceholder: 'Search quizzes, questions, or learners…',
      primaryActionLabel: '+ New Quiz',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="attempts">Attempts</TabsTrigger>
          <TabsTrigger value="answers">Answers</TabsTrigger>
        </TabsList>

        <TabsContent value="quizzes" className="space-y-6 pt-4">
          <QuizzesTab search={search} toast={toast} modalOpen={modalOpen} setModalOpen={setModalOpen} />
        </TabsContent>
        <TabsContent value="questions" className="space-y-6 pt-4">
          <QuestionsTab search={search} />
        </TabsContent>
        <TabsContent value="options" className="space-y-6 pt-4">
          <OptionsTab search={search} />
        </TabsContent>
        <TabsContent value="attempts" className="space-y-6 pt-4">
          <AttemptsTab search={search} />
        </TabsContent>
        <TabsContent value="answers" className="space-y-6 pt-4">
          <AnswersTab search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ================================================================
   Quizzes Tab
   ================================================================ */

function QuizzesTab({
  search,
  toast,
  modalOpen,
  setModalOpen,
}: {
  search: string;
  toast: ReturnType<typeof useToast>['toast'];
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [dateRange, setDateRange] = useState('any');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, avgPass: 0, urgent: 0, activeAttempts: 0 });
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);

  const [deleteId, setDeleteId] = useState<number | null>(null);

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
      } catch { setModalCourses([]); }
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
      setStats({ total: all.count, avgPass: agg.avgPass, urgent: agg.urgent, activeAttempts: attempts.count });
    } finally { setStatsLoading(false); }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: QuizRow[] }>('/api/quizzes/admin/list/', {
        params: { page, search, course: courseId || undefined },
      });
      setRows(data.results);
      setTotal(data.count);
    } finally { setLoading(false); }
  }, [page, search, courseId, dateRange]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTable(); }, [loadTable]);

  const handleEditQuiz = useCallback(async (quizId: number) => {
    try {
      const { data } = await api.get<{ course: { id: number } }>(`/api/quizzes/${quizId}/`);
      const cid = data.course?.id;
      if (cid != null) { router.push(`/dashboard/instructor/courses/${cid}/edit`); toast('Opening course editor…', 'info'); }
      else toast('Could not resolve course for this quiz.', 'error');
    } catch (e) { toast(errorMessage(e), 'error'); }
  }, [router, toast]);

  const handleCopyQuizLink = useCallback(async (quizId: number) => {
    try {
      const { data } = await api.get<{ course: { id: number } }>(`/api/quizzes/${quizId}/`);
      const cid = data.course?.id;
      if (cid == null) { toast('Could not resolve course for this quiz.', 'error'); return; }
      const path = `/courses/${cid}/quiz/${quizId}`;
      const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      await navigator.clipboard.writeText(url);
      toast('Quiz link copied to clipboard.', 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
  }, [toast]);

  const handleDeleteQuiz = useCallback(async () => {
    if (deleteId == null) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await api.delete(`/api/quizzes/${id}/`);
      toast('Quiz deleted.', 'success');
      await loadTable();
      await loadStats();
    } catch (e) { toast(errorMessage(e), 'error'); }
  }, [deleteId, loadTable, loadStats, toast]);

  const handleCreateQuiz = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = Number(createCourseId);
    if (!cid) { toast('Please select a course.', 'error'); return; }
    const title = createTitle.trim();
    if (!title) { toast('Title is required.', 'error'); return; }
    const qText = createQuestionText.trim();
    if (!qText) { toast('Question text is required.', 'error'); return; }
    const o0 = createOpt0.trim();
    const o1 = createOpt1.trim();
    if (!o0 || !o1) { toast('Both answer options are required.', 'error'); return; }
    const passPct = Math.min(100, Math.max(0, Number(createPassPct) || 70));
    setCreateSubmitting(true);
    try {
      await api.post(`/api/quizzes/course/${cid}/`, {
        title,
        description: createDescription.trim(),
        pass_percentage: passPct,
        is_published: false,
        questions: [{ question_text: qText, marks: 1, sort_order: 0, options: [{ option_text: o0, is_correct: createCorrectIndex === 0 }, { option_text: o1, is_correct: createCorrectIndex === 1 }] }],
      });
      toast('Quiz created.', 'success');
      setModalOpen(false);
      resetCreateForm();
      await loadTable();
      await loadStats();
    } catch (err) { toast(errorMessage(err), 'error'); }
    finally { setCreateSubmitting(false); }
  }, [createCourseId, createTitle, createDescription, createPassPct, createQuestionText, createOpt0, createOpt1, createCorrectIndex, loadTable, loadStats, resetCreateForm, toast, setModalOpen]);

  const columns: Column<QuizRow>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-muted-foreground">#QZ-{r.id}</span> },
    {
      key: 'ctx', header: 'Course / Module', render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.course_title}</p>
          {r.module_title ? <p className="text-xs text-muted-foreground">Module: {r.module_title}</p> : null}
        </div>
      ),
    },
    { key: 'title', header: 'Quiz Title', render: (r) => <span className="font-medium text-foreground">{r.title}</span> },
    {
      key: 'pass', header: 'Pass %', render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${r.pass_percentage}%` }} />
          </div>
          <span className="text-sm tabular-nums text-foreground">{r.pass_percentage}%</span>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', render: (r) =>
        r.is_published
          ? <Badge variant="default" className="text-xs font-bold uppercase">Published</Badge>
          : <Badge variant="secondary" className="text-xs font-bold uppercase">Draft</Badge>,
    },
    { key: 'created_at', header: 'Created', render: (r) => <span className="text-muted-foreground">{formatDate(r.created_at)}</span> },
    {
      key: 'actions', header: 'Actions', render: (r) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => handleEditQuiz(r.id)}><Edit className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy link" onClick={() => handleCopyQuizLink(r.id)}><Copy className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete quiz"
        description="Delete this quiz? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteQuiz}
      />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetCreateForm(); }}
        title="New quiz"
        subtitle="Create a quiz with a starter question. You can add more on the course edit page."
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleCreateQuiz}>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course *</Label>
            <Select value={createCourseId ? String(createCourseId) : SELECT_NONE} onValueChange={(v) => { const next = v ?? ''; setCreateCourseId(next === SELECT_NONE ? '' : next); }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>Select a course</SelectItem>
                {modalCourses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title *</Label>
            <Input type="text" required value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Quiz title" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</Label>
            <Textarea className="min-h-[72px]" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pass percentage</Label>
            <Input type="number" min={0} max={100} value={createPassPct} onChange={(e) => setCreatePassPct(e.target.value)} />
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Starter question</p>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question text *</Label>
              <Textarea className="min-h-[64px]" required value={createQuestionText} onChange={(e) => setCreateQuestionText(e.target.value)} placeholder="Your first question" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="min-w-[200px] flex-1" value={createOpt0} onChange={(e) => setCreateOpt0(e.target.value)} placeholder="Option A" aria-label="Option A" />
                <Label className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                  <input type="radio" name="correct-opt" checked={createCorrectIndex === 0} onChange={() => setCreateCorrectIndex(0)} /> Correct
                </Label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="min-w-[200px] flex-1" value={createOpt1} onChange={(e) => setCreateOpt1(e.target.value)} placeholder="Option B" aria-label="Option B" />
                <Label className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                  <input type="radio" name="correct-opt" checked={createCorrectIndex === 1} onChange={() => setCreateCorrectIndex(1)} /> Correct
                </Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button type="submit" disabled={createSubmitting}>{createSubmitting ? 'Creating…' : 'Create quiz'}</Button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Quizzes" value={statsLoading ? '—' : stats.total} icon={<FileQuestion className="h-5 w-5" />} />
        <StatsCard label="Avg. Pass Rate" value={statsLoading ? '—' : `${stats.avgPass}%`} icon={<Percent className="h-5 w-5" />} />
        <StatsCard label="Urgent Reviews" value={statsLoading ? '—' : stats.urgent} variant="warning" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatsCard label="Active Attempts" value={statsLoading ? '—' : stats.activeAttempts} icon={<Activity className="h-5 w-5" />} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</Label>
            <Select value={courseId ? courseId : SELECT_ALL} onValueChange={(v) => { const next = v ?? ''; setCourseId(next === SELECT_ALL ? '' : next); setPage(1); }}>
              <SelectTrigger className="w-[min(100%,280px)]"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_ALL}>All</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date Range</Label>
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v ?? 'any'); setPage(1); }}>
              <SelectTrigger className="w-[min(100%,200px)]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No quizzes found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="quizzes" />
    </>
  );
}

/* ================================================================
   Questions Tab
   ================================================================ */

function QuestionsTab({ search }: { search: string }) {
  const [page, setPage] = useState(1);
  const [quizTitle, setQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [quizTitles, setQuizTitles] = useState<string[]>([]);
  const apiSearch = quizTitle || search;

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ title: string }>('/api/quizzes/admin/list/', { page: 1 });
      setQuizTitles(Array.from(new Set(data.results.map((q) => q.title))));
    })();
  }, []);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: QuestionRow[] }>('/api/quizzes/admin/questions/', { params: { page, search: apiSearch } });
      setRows(data.results);
      setTotal(data.count);
    } finally { setLoading(false); }
  }, [page, apiSearch]);

  useEffect(() => { loadTable(); }, [loadTable]);

  const columns: Column<QuestionRow>[] = useMemo(() => [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-muted-foreground">#Q-{r.id}</span> },
    { key: 'quiz', header: 'Quiz', render: (r) => <p className="font-medium text-foreground">{r.quiz_title}</p> },
    { key: 'question_text', header: 'Question', render: (r) => <p className="max-w-md truncate text-foreground">{r.question_text}</p> },
    {
      key: 'question_type', header: 'Type', render: (r) => (
        <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 font-semibold uppercase text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
          {(r.question_type || 'mcq').toUpperCase()}
        </Badge>
      ),
    },
    { key: 'marks', header: 'Marks', render: (r) => <span className="tabular-nums">{r.marks ?? '—'}</span> },
    {
      key: 'sort_order', header: 'Order', render: (r) => (
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground" />
          <span className="tabular-nums">{r.sort_order}</span>
        </div>
      ),
    },
  ], []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard label="Total Questions" value={loading ? '—' : total} icon={<FileQuestion className="h-5 w-5" />} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</Label>
          <Select value={quizTitle || SELECT_ALL} onValueChange={(v) => { setQuizTitle((v ?? '') === SELECT_ALL ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger className="mt-1 w-full min-w-[220px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL}>All</SelectItem>
              {quizTitles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No questions found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="questions" />
    </>
  );
}

/* ================================================================
   Options Tab
   ================================================================ */

function OptionsTab({ search }: { search: string }) {
  const [page, setPage] = useState(1);
  const [questionId, setQuestionId] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [questions, setQuestions] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; question_text: string }>('/api/quizzes/admin/questions/', { page: 1 });
      setQuestions(data.results.map((q) => ({ id: q.id, label: q.question_text.length > 60 ? `${q.question_text.slice(0, 60)}…` : q.question_text })));
    })();
  }, []);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: OptionRow[] }>('/api/quizzes/admin/options/', { params: { page, search, question: questionId || undefined } });
      const list = [...data.results].sort((a, b) => sortAsc ? a.sort_order - b.sort_order : b.sort_order - a.sort_order);
      setRows(list);
      setTotal(data.count);
    } finally { setLoading(false); }
  }, [page, search, questionId, sortAsc]);

  useEffect(() => { loadTable(); }, [loadTable]);

  const columns: Column<OptionRow>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-muted-foreground">#OPT-{r.id}</span> },
    { key: 'question', header: 'Question', render: (r) => <p className="max-w-sm text-sm text-foreground">{r.question_text_preview}</p> },
    {
      key: 'option_text', header: 'Option', render: (r) => (
        <div className="max-w-md rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">{r.option_text}</div>
      ),
    },
    {
      key: 'is_correct', header: 'Status', render: (r) =>
        r.is_correct
          ? <Badge variant="outline" className="gap-0.5 border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400"><Check className="size-3.5" />CORRECT</Badge>
          : <Badge variant="destructive" className="gap-0.5 font-bold"><X className="size-3.5" />INCORRECT</Badge>,
    },
    { key: 'sort_order', header: 'Order', render: (r) => <span className="tabular-nums">{r.sort_order}</span> },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</Label>
          <Select value={questionId || SELECT_ALL} onValueChange={(v) => { setQuestionId((v ?? '') === SELECT_ALL ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger className="mt-1 w-full min-w-[200px] max-w-xs"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL}>All</SelectItem>
              {questions.map((q) => <SelectItem key={q.id} value={String(q.id)}>{q.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant={sortAsc ? 'default' : 'outline'} size="sm" onClick={() => setSortAsc((v) => !v)}>
          {sortAsc ? 'Ascending' : 'Descending'}
        </Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No options found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="options" />
    </>
  );
}

/* ================================================================
   Attempts Tab
   ================================================================ */

function AttemptsTab({ search }: { search: string }) {
  const [page, setPage] = useState(1);
  const [quizId, setQuizId] = useState('');
  const [passed, setPassed] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, passing: 0, failed: 0 });
  const [quizzes, setQuizzes] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/quizzes/admin/list/', { page: 1 });
      setQuizzes(data.results.map((q) => ({ id: q.id, title: q.title })));
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, ok, bad, agg] = await Promise.all([
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page: 1, search }),
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page: 1, search, is_passed: true }),
        fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page: 1, search, is_passed: false }),
        aggregateAttempts(search),
      ]);
      setStats({ total: all.count, avgScore: agg.avgPct, passing: ok.count, failed: bad.count });
    } finally { setStatsLoading(false); }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: AttemptRow[] }>('/api/quizzes/admin/attempts/', {
        params: { page, search, quiz: quizId || undefined, is_passed: passed === 'passed' ? true : passed === 'failed' ? false : undefined },
      });
      setRows(data.results);
      setTotal(data.count);
    } finally { setLoading(false); }
  }, [page, search, quizId, passed]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTable(); }, [loadTable]);

  const columns: Column<AttemptRow>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-muted-foreground">#QA-{r.id}</span> },
    {
      key: 'learner', header: 'Learner', render: (r) => {
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
    { key: 'quiz_title', header: 'Quiz', render: (r) => <span className="font-medium text-foreground">{r.quiz_title}</span> },
    { key: 'score', header: 'Score', render: (r) => <span className="tabular-nums">{r.score} / {r.total_marks}</span> },
    {
      key: 'pct', header: '%', render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.percentage)}%` }} /></div>
          <span className="text-sm tabular-nums">{r.percentage}%</span>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', render: (r) =>
        r.is_passed
          ? <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">PASSED</Badge>
          : <Badge variant="destructive" className="font-bold">FAILED</Badge>,
    },
    { key: 'started_at', header: 'Started', render: (r) => formatDateTime(r.started_at) },
    { key: 'submitted_at', header: 'Submitted', render: (r) => formatDateTime(r.submitted_at) },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Attempts" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Avg. Score" value={statsLoading ? '—' : `${stats.avgScore}%`} />
        <StatsCard label="Passed" value={statsLoading ? '—' : stats.passing} />
        <StatsCard label="Failed" value={statsLoading ? '—' : stats.failed} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</Label>
          <Select value={quizId || SELECT_ALL} onValueChange={(v) => { setQuizId((v ?? '') === SELECT_ALL ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger className="mt-1 w-[220px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL}>All</SelectItem>
              {quizzes.map((q) => <SelectItem key={q.id} value={String(q.id)}>{q.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
          <Select value={passed || SELECT_ALL} onValueChange={(v) => { const s = v ?? SELECT_ALL; setPassed(s === SELECT_ALL ? '' : s); setPage(1); }}>
            <SelectTrigger className="mt-1 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL}>All</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => { setQuizId(''); setPassed(''); setPage(1); }}>Reset</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No attempts found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="attempts" />
    </>
  );
}

/* ================================================================
   Answers Tab
   ================================================================ */

function AnswersTab({ search }: { search: string }) {
  const [page, setPage] = useState(1);
  const [attemptId, setAttemptId] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AnswerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ correctRate: 0, avgErrors: 0, total: 0 });
  const [attempts, setAttempts] = useState<{ id: number; label: string }[]>([]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; quiz_title: string }>('/api/quizzes/admin/attempts/', { page: 1 });
      setAttempts(data.results.map((a) => ({ id: a.id, label: `ATT-${a.id} · ${a.quiz_title}` })));
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const agg = await aggregateAnswers(search);
      setStats(agg);
    } finally { setStatsLoading(false); }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: AnswerRow[] }>('/api/quizzes/admin/answers/', { params: { page, search, attempt: attemptId || undefined } });
      setRows(data.results);
      setTotal(data.count);
    } finally { setLoading(false); }
  }, [page, search, attemptId]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTable(); }, [loadTable]);

  const columns: Column<AnswerRow>[] = useMemo(() => [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-muted-foreground">ANS-{r.id}</span> },
    { key: 'attempt', header: 'Attempt', render: (r) => <Badge variant="outline" className="font-mono text-xs">ATT-{r.attempt_id}</Badge> },
    { key: 'question', header: 'Question', render: (r) => <p className="max-w-sm truncate text-foreground">{r.question_text_preview}</p> },
    { key: 'selected', header: 'Selected', render: (r) => <span className="text-foreground">{r.selected_option_text}</span> },
    {
      key: 'correct', header: 'Correct', render: (r) =>
        r.is_correct
          ? <Badge variant="outline" className="gap-0.5 border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400"><Check className="size-3.5" />YES</Badge>
          : <Badge variant="destructive" className="gap-0.5 font-bold"><X className="size-3.5" />NO</Badge>,
    },
    { key: 'marks', header: 'Marks', render: (r) => <span className="tabular-nums">{r.marks_awarded}</span> },
  ], []);

  const correctN = rows.filter((r) => r.is_correct).length;
  const wrongN = rows.filter((r) => !r.is_correct).length;

  const exportCsv = () => {
    const header = ['id', 'attempt_id', 'question', 'selected_option', 'is_correct', 'marks_awarded'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([r.id, r.attempt_id, JSON.stringify(r.question_text_preview), JSON.stringify(r.selected_option_text), r.is_correct, r.marks_awarded].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-answers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Correct Rate" value={statsLoading ? '—' : `${stats.correctRate}%`} />
        <StatsCard label="Avg Errors" value={statsLoading ? '—' : stats.avgErrors} />
        <StatsCard label="Total Responses" value={statsLoading ? '—' : stats.total} />
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Page Mix</p>
              <p className="mt-1 text-sm"><span className="text-emerald-600 dark:text-emerald-400">{correctN} correct</span> / <span className="text-destructive">{wrongN} wrong</span></p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attempt</Label>
          <Select value={attemptId || SELECT_ALL} onValueChange={(v) => { setAttemptId((v ?? '') === SELECT_ALL ? '' : (v ?? '')); setPage(1); }}>
            <SelectTrigger className="mt-1 w-full min-w-[200px] max-w-xs"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL}>All</SelectItem>
              {attempts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No answers found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="responses" />
    </>
  );
}

/* ================================================================
   Helpers
   ================================================================ */

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

async function aggregateAttempts(search?: string) {
  let page = 1;
  let sum = 0;
  let n = 0;
  while (true) {
    const data = await fetchPage<AttemptRow>('/api/quizzes/admin/attempts/', { page, search });
    for (const a of data.results) { sum += a.percentage ?? 0; n += 1; }
    if (!data.next) break;
    page += 1;
    if (page > 80) break;
  }
  return { avgPct: n ? Math.round(sum / n) : 0 };
}

async function aggregateAnswers(search?: string) {
  let page = 1;
  let correct = 0;
  let total = 0;
  while (true) {
    const data = await fetchPage<AnswerRow>('/api/quizzes/admin/answers/', { page, search });
    for (const r of data.results) { total += 1; if (r.is_correct) correct += 1; }
    if (!data.next) break;
    page += 1;
    if (page > 100) break;
  }
  const correctRate = total ? Math.round((correct / total) * 100) : 0;
  const avgErrors = total ? Math.round(((total - correct) / total) * 100) / 100 : 0;
  return { correctRate, avgErrors, total };
}
