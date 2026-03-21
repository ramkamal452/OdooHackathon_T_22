'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
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
import { Check, MoreVertical, X } from 'lucide-react';
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
const ALL_ATTEMPTS = '__all__';

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
        render: (r) => <span className="font-mono text-muted-foreground">ANS-{r.id}</span>,
      },
      {
        key: 'attempt',
        header: 'Attempt ID',
        render: (r) => (
          <Badge variant="outline" className="font-mono text-xs">
            ATT-{r.attempt_id}
          </Badge>
        ),
      },
      {
        key: 'question',
        header: 'Question',
        render: (r) => (
          <div>
            <p className="max-w-sm truncate text-foreground">{r.question_text_preview}</p>
            <p className="text-xs text-muted-foreground">Course assessment</p>
          </div>
        ),
      },
      {
        key: 'selected',
        header: 'Selected Option',
        render: (r) => <span className="text-foreground">{r.selected_option_text}</span>,
      },
      {
        key: 'correct',
        header: 'Correct',
        render: (r) =>
          r.is_correct ? (
            <Badge
              variant="outline"
              className="gap-0.5 border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400"
            >
              <Check className="size-3.5" />
              YES
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-0.5 font-bold">
              <X className="size-3.5" />
              NO
            </Badge>
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
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label="More">
            <MoreVertical className="size-5" />
          </Button>
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
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attempt</Label>
            <Select
              value={attemptId || ALL_ATTEMPTS}
              onValueChange={(v) => {
                const s = v ?? '';
                setAttemptId(s === ALL_ATTEMPTS ? '' : s);
                setPage(1);
              }}
            >
              <SelectTrigger className="mt-1 w-full min-w-[200px] max-w-xs">
                <SelectValue placeholder="All attempts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ATTEMPTS}>All</SelectItem>
                {attempts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select disabled value="all">
              <SelectTrigger className="mt-1 w-[160px]" title="Requires API filter for is_correct">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="correct">Correct</SelectItem>
                <SelectItem value="incorrect">Incorrect</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" className="border-dashed">
            More Filters
          </Button>
          <Button type="button" variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
          <Button
            type="button"
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
          >
            Table View
          </Button>
          <Button
            type="button"
            variant={view === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('analytics')}
          >
            Analytics
          </Button>
        </div>
      </div>
      {view === 'analytics' ? (
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-8">
            <p className="text-sm font-medium text-foreground">Response mix (current page)</p>
            <div className="mt-6 flex h-40 items-end gap-8">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 rounded-t bg-emerald-500 dark:bg-emerald-400"
                  style={{ height: `${Math.max(8, (correctN / Math.max(1, correctN + wrongN)) * 160)}px` }}
                />
                <span className="text-xs text-muted-foreground">Correct ({correctN})</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 rounded-t bg-destructive"
                  style={{ height: `${Math.max(8, (wrongN / Math.max(1, correctN + wrongN)) * 160)}px` }}
                />
                <span className="text-xs text-muted-foreground">Incorrect ({wrongN})</span>
              </div>
            </div>
          </CardContent>
        </Card>
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
