'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { GripVertical, Pencil } from 'lucide-react';
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
const ALL_QUIZZES = '__all__';

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
        render: (r) => <span className="font-mono text-muted-foreground">#Q-{r.id}</span>,
      },
      {
        key: 'quiz',
        header: 'Quiz Title',
        render: (r) => (
          <div>
            <p className="font-medium text-foreground">{r.quiz_title}</p>
            <p className="text-xs text-muted-foreground">Assessment question</p>
          </div>
        ),
      },
      {
        key: 'question_text',
        header: 'Question Text',
        render: (r) => (
          <p className="max-w-md truncate text-foreground">{r.question_text}</p>
        ),
      },
      {
        key: 'question_type',
        header: 'Type',
        render: (r) => (
          <Badge
            variant="outline"
            className="border-blue-500/20 bg-blue-500/10 font-semibold uppercase text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300"
          >
            {(r.question_type || 'mcq').toUpperCase()}
          </Badge>
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
            <span className="inline-flex cursor-grab text-muted-foreground" aria-hidden>
              <GripVertical className="size-4" />
            </span>
            <span className="tabular-nums">{r.sort_order}</span>
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: () => (
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
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
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</Label>
            <Select
              value={quizTitle || ALL_QUIZZES}
              onValueChange={(v) => {
                const s = v ?? '';
                setQuizTitle(s === ALL_QUIZZES ? '' : s);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1 w-full min-w-[220px]">
                <SelectValue placeholder="All (use header search)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_QUIZZES}>All (use header search)</SelectItem>
                {quizTitles.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      <aside>
        <Card className="h-fit border-dashed border-primary/30">
          <CardContent className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Database Health</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{loading ? '—' : health}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total questions indexed</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
