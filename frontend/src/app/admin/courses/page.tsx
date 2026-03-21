'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatRelativeAgo } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api, mediaUrl } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

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

interface CategoryOption {
  id: number;
  name: string;
}

const PAGE_SIZE = 10;

export default function AdminCoursesPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
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

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseShortDescription, setCourseShortDescription] = useState('');
  const [courseCategoryId, setCourseCategoryId] = useState('');
  const [courseLevel, setCourseLevel] = useState('beginner');
  const [deleteConfirm, setDeleteConfirm] = useState<CourseRow | null>(null);

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
      primaryActionLabel: '+ New Course',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const { data } = await api.get<CategoryOption[]>('/api/categories/');
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load categories', 'error');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!modalOpen) return;
    loadCategories();
  }, [modalOpen, loadCategories]);

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

  function resetCreateForm() {
    setCourseTitle('');
    setCourseShortDescription('');
    setCourseCategoryId('');
    setCourseLevel('beginner');
  }

  async function handleCreateCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = courseTitle.trim();
    if (!t) {
      toast('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/courses/', {
        title: t,
        short_description: courseShortDescription.trim() || undefined,
        category: courseCategoryId ? Number(courseCategoryId) : null,
        level: courseLevel,
      });
      toast('Course created!', 'success');
      setModalOpen(false);
      resetCreateForm();
      loadStats();
      loadTable();
    } catch {
      toast('Failed to create course', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCourse(row: CourseRow) {
    try {
      await api.delete(`/api/courses/${row.id}/`);
      toast('Course deleted!', 'success');
      setDeleteConfirm(null);
      loadStats();
      loadTable();
    } catch {
      toast('Failed to delete course', 'error');
    }
  }

  const columns: Column<CourseRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#CR-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Title & Thumbnail',
      render: (r) => {
        const thumb = mediaUrl((r as { thumbnail?: string | null }).thumbnail);
        return (
          <div className="flex max-w-xs items-start gap-3">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
              {thumb ? (
                <img src={thumb} alt="" className="h-12 w-16 object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
                  No img
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{r.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Updated {formatRelativeAgo(r.created_at)}</p>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-600 dark:bg-blue-400/20 dark:text-blue-400">
            {(r.instructor_name || '?').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-gray-800 dark:text-gray-200">{r.instructor_name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) =>
        r.category_name ? (
          <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            {r.category_name}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (r) => <span className="capitalize text-gray-700 dark:text-gray-300">{r.level || '—'}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => (
        <span className="text-gray-700 dark:text-gray-300">
          {r.duration_minutes != null ? `${r.duration_minutes} min` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.status === 'published' ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            Published
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-400/10 dark:bg-gray-400/10 dark:text-gray-400">
            Draft
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/instructor/courses/${r.id}/edit`}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            aria-label="Edit course"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setDeleteConfirm(r)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            aria-label="Delete course"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
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
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/20 bg-white/70 p-1 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
          {(['all', 'published', 'draft'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                  : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-white/10'
              }`}
            >
              {t === 'all' ? 'All Courses' : t === 'published' ? 'Published' : 'Drafts'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-sm"
        >
          + Filter
        </button>
      </div>
      {filterOpen ? (
        <div className="glass-card flex flex-wrap gap-4 rounded-2xl border border-dashed border-blue-200/50 p-4 dark:border-blue-500/20">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Category ID
            </label>
            <input
              className="glass-input mt-1 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Level
            </label>
            <select
              className="glass-input mt-1 text-sm"
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

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetCreateForm();
        }}
        title="New Course"
        subtitle="Create a course draft. You can add modules and lessons from the instructor editor."
        size="lg"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              className="glass-input mt-1 w-full"
              placeholder="Course title"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Short description</label>
            <textarea
              value={courseShortDescription}
              onChange={(e) => setCourseShortDescription(e.target.value)}
              className="glass-input mt-1 min-h-[88px] w-full resize-y"
              placeholder="Brief summary for listings"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                value={courseCategoryId}
                onChange={(e) => setCourseCategoryId(e.target.value)}
                disabled={categoriesLoading}
                className="glass-input mt-1 w-full"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
              <select
                value={courseLevel}
                onChange={(e) => setCourseLevel(e.target.value)}
                className="glass-input mt-1 w-full"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                resetCreateForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete course"
        subtitle="This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <strong className="text-gray-900 dark:text-white">{deleteConfirm?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteConfirm && handleDeleteCourse(deleteConfirm)}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:from-rose-600 hover:to-rose-700"
          >
            Delete
          </button>
        </div>
      </Modal>
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
