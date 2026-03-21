'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
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
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { Check, Pencil, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface OptionRow {
  id: number;
  question_text_preview: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

const PAGE_SIZE = 10;
const ALL_QUESTIONS = '__all__';

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
      render: (r) => <span className="font-mono text-muted-foreground">#OPT-{r.id}</span>,
    },
    {
      key: 'question',
      header: 'Linked Question',
      render: (r) => (
        <div>
          <p className="max-w-sm text-sm text-foreground">{r.question_text_preview}</p>
          <p className="text-xs text-muted-foreground">Quiz module context</p>
        </div>
      ),
    },
    {
      key: 'option_text',
      header: 'Option Content',
      render: (r) => (
        <div className="max-w-md rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
          {r.option_text}
        </div>
      ),
    },
    {
      key: 'is_correct',
      header: 'Status',
      render: (r) =>
        r.is_correct ? (
          <Badge
            variant="outline"
            className="gap-0.5 border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400"
          >
            <Check className="size-3.5" />
            CORRECT
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-0.5 font-bold">
            <X className="size-3.5" />
            INCORRECT
          </Badge>
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
        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Edit">
          <Pencil className="size-4" />
        </Button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</Label>
          <Select
            value={questionId || ALL_QUESTIONS}
            onValueChange={(v) => {
              const s = v ?? '';
              setQuestionId(s === ALL_QUESTIONS ? '' : s);
              setPage(1);
            }}
          >
            <SelectTrigger className="mt-1 w-full min-w-[200px] max-w-xs">
              <SelectValue placeholder="All questions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUESTIONS}>All</SelectItem>
              {questions.map((q) => (
                <SelectItem key={q.id} value={String(q.id)}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sort Order</span>
          <Button
            type="button"
            variant={sortAsc ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortAsc((v) => !v)}
          >
            {sortAsc ? 'Ascending' : 'Descending'}
          </Button>
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
