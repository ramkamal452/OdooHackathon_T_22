'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatRelativeAgo } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api, mediaUrl } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface CourseRow {
  id: number;
  title: string;
  slug?: string;
  instructor_name?: string;
  category_name?: string | null;
  level?: string;
  status?: string;
  lesson_count?: number;
  duration_minutes?: number | null;
  created_at?: string;
}

const PAGE_SIZE = 10;

export default function AdminCoursesPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'all' | 'published' | 'draft'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    instructors: 0,
    avgDuration: 0,
  });

  const statusParam = useMemo(() => {
    if (tab === 'published') return 'published';
    if (tab === 'draft') return 'draft';
    return undefined;
  }, [tab]);

  useEffect(() => {
    setHeader({
      title: 'Course Catalog',
      subtitle: 'Browse and manage all courses on the platform.',
      searchPlaceholder: 'Search courses by title…',
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
    });
  }, [setHeader]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, drafts, listData] = await Promise.all([
        fetchPage<CourseRow>('/api/admin/courses/', { page: 1, search }),
        fetchPage<CourseRow>('/api/admin/courses/', { page: 1, status: 'draft', search }),
        fetchAllCoursesForStats(search),
      ]);
      setStats({
        total: all.count,
        drafts: drafts.count,
        instructors: listData.uniqueInstructors,
        avgDuration: listData.avgDuration,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: CourseRow[] }>(
        '/api/admin/courses/',
        {
          params: {
            page,
            search,
            status: statusParam,
            category: categoryId || undefined,
            level: level || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusParam, categoryId, level]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, categoryId, level]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<CourseRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">#CR-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Title & Thumbnail',
      render: (r) => {
        const thumb = mediaUrl((r as { thumbnail?: string | null }).thumbnail);
        return (
          <div className="flex max-w-xs items-start gap-3">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
              {thumb ? (
                <img src={thumb} alt="" className="h-12 w-16 object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                  No img
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">Updated {formatRelativeAgo(r.created_at)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'instructor',
      header: 'Instructor',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
            {(r.instructor_name || '?').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-gray-800">{r.instructor_name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) =>
        r.category_name ? (
          <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {r.category_name}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (r) => <span className="capitalize text-gray-700">{r.level || '—'}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => (
        <span className="text-gray-700">
          {r.duration_minutes != null ? `${r.duration_minutes} min` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.status === 'published' ? (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Published
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Draft
          </span>
        ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Courses" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Active Drafts" value={statsLoading ? '—' : stats.drafts} />
        <StatsCard label="Instructors" value={statsLoading ? '—' : stats.instructors} />
        <StatsCard
          label="Avg. Duration"
          value={statsLoading ? '—' : `${Math.round(stats.avgDuration)} min`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-1">
          {(['all', 'published', 'draft'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'all' ? 'All Courses' : t === 'published' ? 'Published' : 'Drafts'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          + Filter
        </button>
      </div>
      {filterOpen ? (
        <div className="flex flex-wrap gap-4 rounded-xl border border-dashed border-blue-100 bg-white p-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
              Category ID
            </label>
            <input
              className="mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
              Level
            </label>
            <select
              className="mt-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">Any</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      ) : null}
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No courses found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="courses"
      />
    </div>
  );
}

async function fetchAllCoursesForStats(search?: string) {
  let page = 1;
  const instructorNames = new Set<string>();
  let durationSum = 0;
  let durationCount = 0;
  while (true) {
    const data = await fetchPage<CourseRow>('/api/admin/courses/', { page, search });
    for (const c of data.results) {
      if (c.instructor_name) instructorNames.add(c.instructor_name);
      if (c.duration_minutes != null) {
        durationSum += c.duration_minutes;
        durationCount += 1;
      }
    }
    if (!data.next) break;
    page += 1;
    if (page > 200) break;
  }
  return {
    uniqueInstructors: instructorNames.size,
    avgDuration: durationCount ? durationSum / durationCount : 0,
  };
}
