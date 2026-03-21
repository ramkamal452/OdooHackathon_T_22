'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { api } from '@/lib/api';
import { formatRelativeAgo } from '@/lib/admin-format';
import { Users, UserCheck, Clock, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface EnrollmentRow extends Record<string, unknown> {
  id: number;
  learner_name?: string;
  learner_email?: string;
  course_title?: string;
  status?: string;
  progress_percent?: number;
  time_spent_seconds?: number;
  enrolled_at?: string;
  completed_at?: string;
}

const PAGE_SIZE = 10;

function formatDuration(seconds?: number) {
  if (!seconds) return '—';
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
      return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400">In Progress</Badge>;
    case 'enrolled':
      return <Badge variant="secondary">Enrolled</Badge>;
    case 'invited':
      return <Badge variant="outline">Invited</Badge>;
    default:
      return <Badge variant="secondary">{s || 'Unknown'}</Badge>;
  }
}

export default function AdminEnrollmentsPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, avgProgress: 0 });

  useEffect(() => {
    setHeader({
      title: 'Enrollments',
      subtitle: 'Track learner enrollments and progress across all courses.',
      searchPlaceholder: 'Search by learner or course…',
    });
  }, [setHeader]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: EnrollmentRow[] }>(
        '/api/admin/enrollments/',
        { params: { page, search: search || undefined } }
      );
      setRows(data.results ?? []);
      setTotal(data.count ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: EnrollmentRow[] }>(
        '/api/admin/enrollments/',
        { params: { page: 1, page_size: 100 } }
      );
      const all = data.results ?? [];
      const completed = all.filter((r) => r.status === 'completed').length;
      const inProgress = all.filter((r) => r.status === 'in_progress').length;
      const totalProg = all.reduce((s, r) => s + (r.progress_percent ?? 0), 0);
      setStats({
        total: data.count ?? 0,
        completed,
        inProgress,
        avgProgress: all.length ? Math.round(totalProg / all.length) : 0,
      });
    } catch {
      setStats({ total: 0, completed: 0, inProgress: 0, avgProgress: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { loadTable(); }, [loadTable]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const columns: Column<EnrollmentRow>[] = [
    {
      key: 'id',
      header: '#',
      render: (r) => <span className="font-mono text-muted-foreground">{r.id}</span>,
    },
    {
      key: 'learner',
      header: 'Learner',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {(r.learner_name || r.learner_email || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.learner_name || '—'}</p>
            <p className="truncate text-xs text-muted-foreground">{r.learner_email || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'course_title',
      header: 'Course',
      render: (r) => <span className="font-medium text-foreground">{r.course_title || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => statusBadge(r.status),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.progress_percent ?? 0} className="h-2 w-20" />
          <span className="text-xs text-muted-foreground">{r.progress_percent ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'time_spent',
      header: 'Time Spent',
      render: (r) => <span className="text-muted-foreground">{formatDuration(r.time_spent_seconds)}</span>,
    },
    {
      key: 'enrolled_at',
      header: 'Enrolled',
      render: (r) => (
        <span className="text-muted-foreground">{r.enrolled_at ? formatRelativeAgo(r.enrolled_at) : '—'}</span>
      ),
    },
    {
      key: 'completed_at',
      header: 'Completed',
      render: (r) => (
        <span className="text-muted-foreground">{r.completed_at ? formatRelativeAgo(r.completed_at) : '—'}</span>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Enrollments" value={statsLoading ? '—' : stats.total} icon={<Users className="h-5 w-5" />} />
        <StatsCard label="Completed" value={statsLoading ? '—' : stats.completed} icon={<UserCheck className="h-5 w-5" />} />
        <StatsCard label="In Progress" value={statsLoading ? '—' : stats.inProgress} icon={<Clock className="h-5 w-5" />} />
        <StatsCard label="Avg. Progress" value={statsLoading ? '—' : `${stats.avgProgress}%`} icon={<TrendingUp className="h-5 w-5" />} />
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
