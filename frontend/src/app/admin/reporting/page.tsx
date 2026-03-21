'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { api } from '@/lib/api';
import { formatRelativeAgo } from '@/lib/admin-format';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Settings2, UserX, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface EnrollmentRow extends Record<string, unknown> {
  id: number;
  learner_name?: string;
  learner_email?: string;
  course_title?: string;
  status?: string;
  progress_percent?: number;
  time_spent_seconds?: number;
  enrolled_at?: string;
  started_at?: string;
  completed_at?: string;
  _srNo?: number;
}

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'yet_to_start' | 'in_progress' | 'completed';

type ColumnVisibility = {
  srNo: boolean;
  courseName: boolean;
  participantName: boolean;
  enrolledDate: boolean;
  startDate: boolean;
  timeSpent: boolean;
  completionPct: boolean;
  completedDate: boolean;
  status: boolean;
};

function formatDuration(seconds?: number) {
  if (seconds == null || seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusBadge(s?: string) {
  switch (s) {
    case 'completed':
      return <Badge variant="default">Completed</Badge>;
    case 'in_progress':
      return (
        <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400">In Progress</Badge>
      );
    case 'yet_to_start':
    case 'enrolled':
      return <Badge variant="secondary">Yet to Start</Badge>;
    case 'invited':
      return <Badge variant="outline">Invited</Badge>;
    default:
      return <Badge variant="secondary">{s || 'Unknown'}</Badge>;
  }
}

export default function AdminReportingPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    yetToStart: 0,
    inProgress: 0,
    completed: 0,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    srNo: true,
    courseName: true,
    participantName: true,
    enrolledDate: true,
    startDate: true,
    timeSpent: true,
    completionPct: true,
    completedDate: true,
    status: true,
  });

  useEffect(() => {
    setHeader({
      title: 'Reporting Dashboard',
      subtitle: 'Course-wise learner progress and analytics.',
      searchPlaceholder: 'Search by learner or course…',
    });
  }, [setHeader]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: EnrollmentRow[] }>('/api/admin/enrollments/', {
        params: { page: 1, page_size: PAGE_SIZE, search: search || undefined },
      });
      const results = data.results ?? [];
      setStats({
        totalParticipants: results.length,
        yetToStart: results.filter((r) => r.status === 'yet_to_start' || r.status === 'enrolled').length,
        inProgress: results.filter((r) => r.status === 'in_progress').length,
        completed: results.filter((r) => r.status === 'completed').length,
      });
    } catch {
      setStats({ totalParticipants: 0, yetToStart: 0, inProgress: 0, completed: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: EnrollmentRow[] }>('/api/admin/enrollments/', {
        params: {
          page,
          search: search || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
      });
      const list = data.results ?? [];
      setRows(
        list.map((r, i) => ({
          ...r,
          _srNo: (page - 1) * PAGE_SIZE + i + 1,
        }))
      );
      setTotal(data.count ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const setFilter = (next: StatusFilter) => {
    setStatusFilter(next);
  };

  const allColumns = useMemo((): Column<EnrollmentRow>[] => {
    return [
      {
        key: 'srNo',
        header: 'Sr No',
        render: (r) => <span className="font-mono text-muted-foreground">{r._srNo ?? '—'}</span>,
      },
      {
        key: 'courseName',
        header: 'Course Name',
        render: (r) => <span className="font-medium text-foreground">{r.course_title || '—'}</span>,
      },
      {
        key: 'participantName',
        header: 'Participant Name',
        render: (r) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.learner_name || '—'}</p>
            {r.learner_email ? (
              <p className="truncate text-xs text-muted-foreground">{r.learner_email}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: 'enrolledDate',
        header: 'Enrolled Date',
        render: (r) => (
          <span className="text-muted-foreground">{r.enrolled_at ? formatRelativeAgo(r.enrolled_at) : '—'}</span>
        ),
      },
      {
        key: 'startDate',
        header: 'Start Date',
        render: (r) => {
          const start = r.started_at ?? r.enrolled_at;
          return <span className="text-muted-foreground">{start ? formatRelativeAgo(start) : '—'}</span>;
        },
      },
      {
        key: 'timeSpent',
        header: 'Time Spent',
        render: (r) => <span className="text-muted-foreground">{formatDuration(r.time_spent_seconds)}</span>,
      },
      {
        key: 'completionPct',
        header: 'Completion %',
        render: (r) => (
          <div className="flex items-center gap-2">
            <Progress value={r.progress_percent ?? 0} className="h-2 w-20" />
            <span className="text-xs text-muted-foreground">{r.progress_percent ?? 0}%</span>
          </div>
        ),
      },
      {
        key: 'completedDate',
        header: 'Completed Date',
        render: (r) => (
          <span className="text-muted-foreground">{r.completed_at ? formatRelativeAgo(r.completed_at) : '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) => statusBadge(r.status),
      },
    ];
  }, []);

  const columns = useMemo(() => {
    const visible = allColumns.filter((c) => columnVisibility[c.key as keyof ColumnVisibility]);
    return visible.length > 0 ? visible : allColumns;
  }, [allColumns, columnVisibility]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columnToggles: { key: keyof ColumnVisibility; label: string }[] = [
    { key: 'srNo', label: 'Sr No' },
    { key: 'courseName', label: 'Course Name' },
    { key: 'participantName', label: 'Participant Name' },
    { key: 'enrolledDate', label: 'Enrolled Date' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'timeSpent', label: 'Time Spent' },
    { key: 'completionPct', label: 'Completion %' },
    { key: 'completedDate', label: 'Completed Date' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          className={cn(
            'w-full rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            statusFilter === 'all' && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => setFilter('all')}
        >
          <StatsCard
            label="Total Participants"
            value={statsLoading ? '—' : stats.totalParticipants}
            icon={<Users className="h-5 w-5" />}
          />
        </button>
        <button
          type="button"
          className={cn(
            'w-full rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            statusFilter === 'yet_to_start' && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => setFilter('yet_to_start')}
        >
          <StatsCard
            label="Yet to Start"
            value={statsLoading ? '—' : stats.yetToStart}
            icon={<UserX className="h-5 w-5" />}
          />
        </button>
        <button
          type="button"
          className={cn(
            'w-full rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            statusFilter === 'in_progress' && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => setFilter('in_progress')}
        >
          <StatsCard
            label="In Progress"
            value={statsLoading ? '—' : stats.inProgress}
            icon={<Clock className="h-5 w-5" />}
          />
        </button>
        <button
          type="button"
          className={cn(
            'w-full rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            statusFilter === 'completed' && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => setFilter('completed')}
        >
          <StatsCard
            label="Completed"
            value={statsLoading ? '—' : stats.completed}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Customize Columns
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Customize columns</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {columnToggles.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={`col-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                  <Switch
                    id={`col-${key}`}
                    checked={columnVisibility[key]}
                    onCheckedChange={(v) => setColumnVisibility((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No enrollments found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="enrollments"
      />
    </div>
  );
}
