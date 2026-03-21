'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useCallback, useEffect, useState } from 'react';

interface ModuleRow {
  id: number;
  title: string;
  course_title: string;
  lesson_count?: number;
  sort_order: number;
  description?: string | null;
  created_at?: string;
}

const PAGE_SIZE = 10;

export default function AdminModulesPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filterCourseId, setFilterCourseId] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, incomplete: 0, lessons: 0 });
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<ModuleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formCourseId, setFormCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [deleteConfirm, setDeleteConfirm] = useState<ModuleRow | null>(null);

  useEffect(() => {
    setHeader({
      title: 'Course Modules',
      subtitle: 'Structure courses into ordered modules.',
      searchPlaceholder: 'Search modules or courses…',
      primaryActionLabel: '+ New Module',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const list: { id: number; title: string }[] = [];
      let p = 1;
      while (true) {
        const data = await fetchPage<{ id: number; title: string }>('/api/courses/', { page: p });
        list.push(...data.results.map((c) => ({ id: c.id, title: c.title })));
        if (!data.next) break;
        p += 1;
        if (p > 200) break;
      }
      setCourses(list);
    })();
  }, []);

  useEffect(() => {
    if (!modalOpen || editRow) return;
    setFormCourseId('');
    setTitle('');
    setDescription('');
    setSortOrder('0');
  }, [modalOpen, editRow]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const agg = await aggregateModuleStats(search, filterCourseId || undefined);
      setStats(agg);
    } finally {
      setStatsLoading(false);
    }
  }, [search, filterCourseId]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: ModuleRow[] }>(
        '/api/admin/modules/',
        {
          params: {
            page,
            search,
            course: filterCourseId || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCourseId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  async function openEdit(row: ModuleRow) {
    setEditRow(row);
    try {
      const { data } = await api.get<{
        course: number;
        title: string;
        description?: string | null;
        sort_order: number;
      }>(`/api/modules/${row.id}/`);
      setFormCourseId(String(data.course));
      setTitle(data.title);
      setDescription(data.description ?? '');
      setSortOrder(String(data.sort_order ?? 0));
      setModalOpen(true);
    } catch {
      toast('Failed to load module', 'error');
      setEditRow(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow && !formCourseId) {
      toast('Please select a course', 'error');
      return;
    }
    const sortNum = Number.parseInt(sortOrder, 10);
    const payload = {
      title: title.trim(),
      description: description.trim() || '',
      sort_order: Number.isFinite(sortNum) ? sortNum : 0,
    };
    if (!payload.title) {
      toast('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editRow) {
        await api.patch(`/api/modules/${editRow.id}/`, payload);
        toast('Module updated!', 'success');
      } else {
        await api.post(`/api/courses/${formCourseId}/modules/`, payload);
        toast('Module created!', 'success');
      }
      setModalOpen(false);
      setEditRow(null);
      loadTable();
      loadStats();
    } catch {
      toast(editRow ? 'Failed to update module' : 'Failed to create module', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ModuleRow) {
    try {
      await api.delete(`/api/modules/${row.id}/`);
      toast('Module deleted!', 'success');
      setDeleteConfirm(null);
      loadTable();
      loadStats();
    } catch {
      toast('Failed to delete module', 'error');
    }
  }

  const columns: Column<ModuleRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#MD-{r.id}</span>,
    },
    {
      key: 'course',
      header: 'Course Title',
      render: (r) => (
        <span className="font-medium text-blue-600 dark:text-blue-400">{r.course_title}</span>
      ),
    },
    { key: 'title', header: 'Module Title', render: (r) => <span className="font-medium text-gray-900 dark:text-white">{r.title}</span> },
    {
      key: 'sort_order',
      header: 'Order',
      render: (r) => (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-600 dark:bg-blue-400/20 dark:text-blue-400">
          {r.sort_order}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-gray-500 dark:text-gray-400">
          {r.description?.trim() ? r.description : '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created At',
      render: (r) => formatDate(r.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            aria-label="Edit"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(r)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            aria-label="Delete"
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
        <StatsCard label="Total Modules" value={statsLoading ? '—' : stats.total} />
        <StatsCard label="Incomplete Modules" value={statsLoading ? '—' : stats.incomplete} />
        <StatsCard label="Active Lessons" value={statsLoading ? '—' : stats.lessons} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Course
          </label>
          <select
            className="glass-input mt-1 text-sm"
            value={filterCourseId}
            onChange={(e) => {
              setFilterCourseId(e.target.value);
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
          className="btn-secondary mt-6 px-4 py-2 text-sm font-medium shadow-sm"
        >
          More Filters
        </button>
      </div>
      {moreFilters ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Additional filters can be wired when the API exposes them.</p>
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

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditRow(null);
        }}
        title={editRow ? 'Edit Module' : 'New Module'}
        subtitle={editRow ? `Editing “${editRow.title}”` : 'Add a module to a course.'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {!editRow ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Course</label>
              <select
                required
                value={formCourseId}
                onChange={(e) => setFormCourseId(e.target.value)}
                className="glass-input mt-1 w-full"
              >
                <option value="">Select a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Course</label>
              <p className="mt-1 rounded-lg border border-white/10 bg-white/40 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
                {editRow.course_title}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Course cannot be changed after creation.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input mt-1 w-full"
              placeholder="Module title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass-input mt-1 min-h-[88px] w-full resize-y"
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="glass-input mt-1 w-full"
              min={0}
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditRow(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editRow ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Module"
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
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:from-rose-600 hover:to-rose-700"
          >
            Delete
          </button>
        </div>
      </Modal>
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
