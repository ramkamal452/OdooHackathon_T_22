'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';

interface LessonRow {
  id: number;
  title: string;
  module_title: string;
  course_title: string;
  content_type: string;
  duration_minutes?: number | null;
  sort_order: number;
  is_preview?: boolean;
  created_at?: string;
}

interface LessonDetail {
  id: number;
  module: number;
  title: string;
  content_type: string;
  content_body?: string;
  video_url?: string;
  resource_url?: string;
  duration_minutes?: number | null;
  sort_order: number;
  is_preview?: boolean;
}

interface AdminModuleOption {
  id: number;
  title: string;
  course_title: string;
}

const PAGE_SIZE = 10;

function getApiError(err: unknown): string {
  if (isAxiosError(err) && err.response?.data) {
    const d = err.response.data as Record<string, unknown> | string;
    if (typeof d === 'string') return d;
    if (typeof d === 'object' && d !== null && 'detail' in d) {
      const det = d.detail;
      if (typeof det === 'string') return det;
    }
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && v[0]) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  return 'Something went wrong';
}

async function fetchAllAdminModules(): Promise<AdminModuleOption[]> {
  const out: AdminModuleOption[] = [];
  let page = 1;
  while (true) {
    const data = await fetchPage<AdminModuleOption>('/api/admin/modules/', { page });
    out.push(...data.results);
    if (!data.next) break;
    page += 1;
    if (page > 500) break;
  }
  return out;
}

function ContentIcon({ type }: { type: string }) {
  const common = 'h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400';
  switch (type) {
    case 'video':
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    case 'pdf':
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    case 'link':
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      );
    default:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      );
  }
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

type ContentType = 'text' | 'video' | 'pdf' | 'link';

export default function AdminLessonsPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [modules, setModules] = useState<{ id: number; title: string }[]>([]);
  const [allModules, setAllModules] = useState<AdminModuleOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadEdit, setLoadEdit] = useState(false);
  const [formModuleId, setFormModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [formContentType, setFormContentType] = useState<ContentType>('text');
  const [contentBody, setContentBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isPreview, setIsPreview] = useState(false);

  const [viewRow, setViewRow] = useState<LessonRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setHeader({
      title: 'Lesson Inventory',
      subtitle: 'All lessons across modules and courses.',
      searchPlaceholder: 'Search lessons…',
      primaryActionLabel: '+ New Lesson',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', { page: 1 });
      setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchAllAdminModules();
        setAllModules(list);
      } catch {
        toast('Failed to load modules list', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      setModuleId('');
      return;
    }
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/modules/', {
        page: 1,
        course: courseId,
      });
      setModules(data.results.map((m) => ({ id: m.id, title: m.title })));
    })();
  }, [courseId]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ count: number; results: LessonRow[] }>(
        '/api/admin/lessons/',
        {
          params: {
            page,
            search,
            course: courseId || undefined,
            module: moduleId || undefined,
            content_type: contentType || undefined,
          },
        }
      );
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, courseId, moduleId, contentType]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    if (!modalOpen || editingId !== null) return;
    setFormModuleId('');
    setTitle('');
    setFormContentType('text');
    setContentBody('');
    setVideoUrl('');
    setResourceUrl('');
    setDurationMinutes('');
    setSortOrder('0');
    setIsPreview(false);
  }, [modalOpen, editingId]);

  function buildPayload() {
    const dm =
      durationMinutes.trim() === '' ? null : Math.max(0, parseInt(durationMinutes, 10) || 0);
    const so = Math.max(0, parseInt(sortOrder, 10) || 0);
    return {
      title: title.trim(),
      content_type: formContentType,
      content_body: formContentType === 'text' ? contentBody : '',
      video_url: formContentType === 'video' ? videoUrl : '',
      resource_url: formContentType === 'pdf' || formContentType === 'link' ? resourceUrl : '',
      duration_minutes: dm,
      sort_order: so,
      is_preview: isPreview,
    };
  }

  async function openEdit(r: LessonRow) {
    setLoadEdit(true);
    try {
      const { data } = await api.get<LessonDetail>(`/api/lessons/${r.id}/`);
      setEditingId(r.id);
      setFormModuleId(String(data.module));
      setTitle(data.title);
      setFormContentType(data.content_type as ContentType);
      setContentBody(data.content_body ?? '');
      setVideoUrl(data.video_url ?? '');
      setResourceUrl(data.resource_url ?? '');
      setDurationMinutes(data.duration_minutes != null ? String(data.duration_minutes) : '');
      setSortOrder(String(data.sort_order ?? 0));
      setIsPreview(Boolean(data.is_preview));
      setModalOpen(true);
    } catch (err) {
      toast(getApiError(err), 'error');
    } finally {
      setLoadEdit(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId && !formModuleId) {
      toast('Please select a module', 'error');
      return;
    }
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.patch(`/api/lessons/${editingId}/`, payload);
        toast('Lesson updated', 'success');
      } else {
        await api.post(`/api/modules/${formModuleId}/lessons/`, payload);
        toast('Lesson created', 'success');
      }
      setModalOpen(false);
      setEditingId(null);
      loadTable();
    } catch (err) {
      toast(getApiError(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/lessons/${deleteTarget.id}/`);
      toast('Lesson deleted', 'success');
      setDeleteTarget(null);
      loadTable();
    } catch (err) {
      toast(getApiError(err), 'error');
    } finally {
      setDeleting(false);
    }
  }

  function closeLessonModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  const columns: Column<LessonRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#LS-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Lesson Title',
      render: (r) => <span className="font-medium text-blue-600 dark:text-blue-400">{r.title}</span>,
    },
    {
      key: 'module',
      header: 'Module Title',
      render: (r) => (
        <span className="inline-flex rounded-full border border-white/20 bg-white/50 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-300">
          {r.module_title}
        </span>
      ),
    },
    {
      key: 'content_type',
      header: 'Content Type',
      render: (r) => (
        <div className="flex items-center gap-2 capitalize text-gray-800 dark:text-gray-200">
          <ContentIcon type={r.content_type} />
          {r.content_type}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => (
        <span>{r.duration_minutes != null ? `${r.duration_minutes} min` : '—'}</span>
      ),
    },
    {
      key: 'sort_order',
      header: 'Sort',
      render: (r) => <span className="tabular-nums">{r.sort_order}</span>,
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (r) =>
        r.is_preview ? (
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            YES
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-400/10 dark:bg-gray-400/10 dark:text-gray-400">
            NO
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <button
            type="button"
            onClick={() => setViewRow(r)}
            className="rounded p-1 hover:bg-white/10 hover:text-blue-600 dark:hover:bg-white/10 dark:hover:text-blue-400"
            aria-label="View"
          >
            <EyeIcon />
          </button>
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded p-1 hover:bg-white/10 hover:text-blue-600 dark:hover:bg-white/10 dark:hover:text-blue-400"
            aria-label="Edit"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1 hover:bg-white/10 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-400"
            aria-label="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEdit = editingId !== null;
  const moduleSelectDisabled = isEdit;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Course</label>
          <select
            className="glass-input mt-1 text-sm"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Module</label>
          <select
            className="glass-input mt-1 text-sm"
            value={moduleId}
            onChange={(e) => {
              setModuleId(e.target.value);
              setPage(1);
            }}
            disabled={!courseId}
          >
            <option value="">All</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Content</label>
          <select
            className="glass-input mt-1 text-sm"
            value={contentType}
            onChange={(e) => {
              setContentType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any</option>
            <option value="video">Video</option>
            <option value="text">Text</option>
            <option value="pdf">PDF</option>
            <option value="link">Link</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setCourseId('');
            setModuleId('');
            setContentType('');
            setPage(1);
          }}
          className="btn-secondary px-4 py-2 text-sm font-medium shadow-sm"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => loadTable()}
          className="btn-primary px-4 py-2 text-sm font-semibold"
        >
          Apply
        </button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No lessons found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="lessons"
      />

      <Modal
        open={modalOpen}
        onClose={closeLessonModal}
        title={isEdit ? 'Edit Lesson' : 'New Lesson'}
        subtitle={isEdit ? 'Update lesson content and settings.' : 'Add a lesson to a module.'}
        size="lg"
      >
        {loadEdit ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading lesson…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Module</label>
              <select
                className="glass-input mt-1 w-full text-sm"
                value={formModuleId}
                onChange={(e) => setFormModuleId(e.target.value)}
                required={!isEdit}
                disabled={moduleSelectDisabled}
              >
                {!isEdit && <option value="">Select module…</option>}
                {allModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.course_title} — {m.title}
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Module cannot be changed after creation.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                className="glass-input mt-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Lesson title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content type</label>
              <select
                className="glass-input mt-1 w-full text-sm"
                value={formContentType}
                onChange={(e) => setFormContentType(e.target.value as ContentType)}
              >
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="link">Link</option>
              </select>
            </div>
            {formContentType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                <textarea
                  className="glass-input mt-1 min-h-[120px] w-full resize-y text-sm"
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  placeholder="Lesson text content"
                />
              </div>
            )}
            {formContentType === 'video' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Video URL</label>
                <input
                  className="glass-input mt-1 w-full"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            )}
            {(formContentType === 'pdf' || formContentType === 'link') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resource URL</label>
                <input
                  className="glass-input mt-1 w-full"
                  type="url"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration (minutes)</label>
                <input
                  className="glass-input mt-1 w-full"
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort order</label>
                <input
                  className="glass-input mt-1 w-full"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Preview lesson (visible before enrollment)
            </label>
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
              <button type="button" onClick={closeLessonModal} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!viewRow}
        onClose={() => setViewRow(null)}
        title="Lesson summary"
        subtitle={viewRow ? viewRow.course_title : undefined}
        size="sm"
      >
        {viewRow ? (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Title:</span> {viewRow.title}
            </p>
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Module:</span> {viewRow.module_title}
            </p>
            <p className="capitalize">
              <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span> {viewRow.content_type}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete lesson"
        subtitle="This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <strong className="text-gray-900 dark:text-white">{deleteTarget?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:from-rose-600 hover:to-rose-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
