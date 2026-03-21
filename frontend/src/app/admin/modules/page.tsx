'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Badge } from '@/components/ui/badge';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { api } from '@/lib/api';
import { formatRelativeAgo } from '@/lib/admin-format';
import { Layers, BookOpen, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ModuleRow extends Record<string, unknown> {
  id: number;
  title: string;
  course_title?: string;
  lesson_count?: number;
  sort_order?: number;
  created_at?: string;
}

const PAGE_SIZE = 10;

export default function AdminModulesPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, courses: 0, avgLessons: 0 });

  useEffect(() => {
    setHeader({
      title: 'Modules',
      subtitle: 'Browse and manage all modules across courses.',
      searchPlaceholder: 'Search modules by title…',
    });
  }, [setHeader]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: ModuleRow[] }>(
        '/api/admin/modules/',
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
      const { data } = await api.get<{ count: number; results: ModuleRow[] }>(
        '/api/admin/modules/',
        { params: { page: 1 } }
      );
      const all = data.results ?? [];
      const courseNames = new Set(all.map((m) => m.course_title).filter(Boolean));
      const totalLessons = all.reduce((s, m) => s + (m.lesson_count ?? 0), 0);
      setStats({
        total: data.count ?? 0,
        courses: courseNames.size,
        avgLessons: all.length ? Math.round(totalLessons / all.length) : 0,
      });
    } catch {
      setStats({ total: 0, courses: 0, avgLessons: 0 });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { loadTable(); }, [loadTable]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const columns: Column<ModuleRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-muted-foreground">#{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Module Title',
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.title}</p>
          {r.created_at && (
            <p className="text-xs text-muted-foreground">{formatRelativeAgo(r.created_at)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'course_title',
      header: 'Parent Course',
      render: (r) =>
        r.course_title ? (
          <Badge variant="secondary">{r.course_title}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'lesson_count',
      header: 'Lessons',
      render: (r) => <span className="text-foreground">{r.lesson_count ?? 0}</span>,
    },
    {
      key: 'sort_order',
      header: 'Order',
      render: (r) => <span className="text-muted-foreground">{r.sort_order ?? '—'}</span>,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard label="Total Modules" value={statsLoading ? '—' : stats.total} icon={<Layers className="h-5 w-5" />} />
        <StatsCard label="Across Courses" value={statsLoading ? '—' : stats.courses} icon={<BookOpen className="h-5 w-5" />} />
        <StatsCard label="Avg. Lessons/Module" value={statsLoading ? '—' : stats.avgLessons} icon={<FileText className="h-5 w-5" />} />
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No modules found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="modules"
      />
    </div>
  );
}
