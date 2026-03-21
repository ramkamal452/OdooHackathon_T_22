'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { isAxiosError } from 'axios';
import {
  AlignLeft,
  Edit,
  Eye,
  FileText,
  Link2,
  Trash2,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

interface LessonRow extends Record<string, unknown> {
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

const ALL = '__all__';
const ANY = '__any__';
const NO_MODULE = '__none__';

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
  const cls = 'h-4 w-4 shrink-0 text-primary';
  switch (type) {
    case 'video':
      return <Video className={cls} />;
    case 'pdf':
      return <FileText className={cls} />;
    case 'link':
      return <Link2 className={cls} />;
    default:
      return <AlignLeft className={cls} />;
  }
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

  async function handleSubmit(e: FormEvent) {
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
      render: (r) => <span className="font-mono text-muted-foreground">#LS-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Lesson Title',
      render: (r) => <span className="font-medium text-primary">{r.title}</span>,
    },
    {
      key: 'module',
      header: 'Module Title',
      render: (r) => (
        <Badge variant="secondary" className="font-normal">
          {r.module_title}
        </Badge>
      ),
    },
    {
      key: 'content_type',
      header: 'Content Type',
      render: (r) => (
        <div className="flex items-center gap-2 capitalize text-foreground">
          <ContentIcon type={r.content_type} />
          {r.content_type}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => (
        <span className="text-foreground">
          {r.duration_minutes != null ? `${r.duration_minutes} min` : '—'}
        </span>
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
          <Badge variant="default" className="font-semibold">
            YES
          </Badge>
        ) : (
          <Badge variant="secondary">NO</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Button variant="ghost" size="icon-sm" type="button" onClick={() => setViewRow(r)} aria-label="View">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" type="button" onClick={() => openEdit(r)} aria-label="Edit">
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => setDeleteTarget(r)}
            aria-label="Delete"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEdit = editingId !== null;
  const moduleSelectDisabled = isEdit;

  return (
    <div className="space-y-8">
      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</Label>
            <Select
              value={courseId || ALL}
              onValueChange={(v) => {
                const s = v ?? '';
                setCourseId(s === ALL ? '' : s);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Module</Label>
            <Select
              value={moduleId || ALL}
              onValueChange={(v) => {
                const s = v ?? '';
                setModuleId(s === ALL ? '' : s);
                setPage(1);
              }}
              disabled={!courseId}
            >
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Content</Label>
            <Select
              value={contentType || ANY}
              onValueChange={(v) => {
                const s = v ?? '';
                setContentType(s === ANY ? '' : s);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full min-w-[160px]">
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCourseId('');
              setModuleId('');
              setContentType('');
              setPage(1);
            }}
          >
            Reset
          </Button>
          <Button type="button" onClick={() => loadTable()}>
            Apply
          </Button>
        </CardContent>
      </Card>
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
          <p className="text-sm text-muted-foreground">Loading lesson…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select
                value={formModuleId || NO_MODULE}
                onValueChange={(v) => {
                  const s = v ?? '';
                  setFormModuleId(s === NO_MODULE ? '' : s);
                }}
                disabled={moduleSelectDisabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select module…" />
                </SelectTrigger>
                <SelectContent>
                  {!isEdit && <SelectItem value={NO_MODULE}>Select module…</SelectItem>}
                  {allModules.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.course_title} — {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="text-xs text-muted-foreground">Module cannot be changed after creation.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Lesson title" />
            </div>
            <div className="space-y-2">
              <Label>Content type</Label>
              <Select value={formContentType} onValueChange={(v) => setFormContentType(v as ContentType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formContentType === 'text' && (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  className="min-h-[120px] resize-y text-sm"
                  value={contentBody}
                  onChange={(e) => setContentBody(e.target.value)}
                  placeholder="Lesson text content"
                />
              </div>
            )}
            {formContentType === 'video' && (
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
              </div>
            )}
            {(formContentType === 'pdf' || formContentType === 'link') && (
              <div className="space-y-2">
                <Label>Resource URL</Label>
                <Input type="url" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://…" />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
                className="size-4 rounded border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Preview lesson (visible before enrollment)
            </label>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={closeLessonModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </Button>
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
          <div className="space-y-2 text-sm text-foreground">
            <p>
              <span className="font-medium text-muted-foreground">Title:</span> {viewRow.title}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Module:</span> {viewRow.module_title}
            </p>
            <p className="capitalize">
              <span className="font-medium text-muted-foreground">Type:</span> {viewRow.content_type}
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
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong className="text-foreground">{deleteTarget?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" type="button" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
