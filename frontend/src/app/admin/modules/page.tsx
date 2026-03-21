'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface ModuleRow {
  id: number;
  title: string;
  course_title: string;
  lesson_count?: number;
  sort_order: number;
  created_at?: string;
}

const PAGE_SIZE = 10;

export default function AdminModulesPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, incomplete: 0, lessons: 0 });
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Course Modules',
      subtitle: 'Structure courses into ordered modules.',
      searchPlaceholder: 'Search modules or courses…',
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', {
        page: 1,
      });
      setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const agg = await aggregateModuleStats(search, courseId || undefined);
      setStats(agg);
    } finally {
      setStatsLoading(false);
    }
  }, [search, courseId]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: ModuleRow[] }>(
        '/api/admin/modules/',
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
  }, [page, search, courseId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<ModuleRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">#MD-{r.id}</span>,
    },
    {
      key: 'course',
      header: 'Course Title',
      render: (r) => (
        <span className="font-medium text-blue-600">{r.course_title}</span>
      ),
    },
    { key: 'title', header: 'Module Title', render: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: 'sort_order',
      header: 'Order',
      render: (r) => (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          {r.sort_order}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: () => <span className="line-clamp-2 max-w-xs text-gray-500">—</span>,
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (r) => formatDate(r.created_at),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Modules" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Incomplete Modules" value={statsLoading ? '—' : stats.incomplete} />
        <StatsCard label="Active Lessons" value={statsLoading ? '—' : stats.lessons} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Course
          </label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setMoreFilters((v) => !v)}
          className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          More Filters
        </button>
      </div>
      {moreFilters ? (
        <p className="text-sm text-gray-500">Additional filters can be wired when the API exposes them.</p>
      ) : null}
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

async function aggregateModuleStats(search?: string, course?: string) {
  let page = 1;
  let total = 0;
  let incomplete = 0;
  let lessons = 0;
  let first = true;
  while (true) {
    const data = await fetchPage<ModuleRow>('/api/admin/modules/', {
      page,
      search,
      course,
    });
    if (first) total = data.count;
    first = false;
    for (const m of data.results) {
      if ((m.lesson_count ?? 0) === 0) incomplete += 1;
      lessons += m.lesson_count ?? 0;
    }
    if (!data.next) break;
    page += 1;
    if (page > 200) break;
  }
  return { total, incomplete, lessons };
}
