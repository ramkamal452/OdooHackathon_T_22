'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatRelativeAgo } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api, mediaUrl } from '@/lib/api';
import { BookOpen, Clock, Edit, FileEdit, Filter, GraduationCap, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

interface CourseRow extends Record<string, unknown> {
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

const LEVEL_FILTER_ANY = '__any__';
const CATEGORY_NONE = '__none__';

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
      render: (r) => <span className="font-mono text-muted-foreground">#CR-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Title & Thumbnail',
      render: (r) => {
        const thumb = mediaUrl((r as { thumbnail?: string | null }).thumbnail);
        return (
          <div className="flex max-w-xs items-start gap-3">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {thumb ? (
                <img src={thumb} alt="" className="h-12 w-16 object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  No img
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground">Updated {formatRelativeAgo(r.created_at)}</p>
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
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {(r.instructor_name || '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-foreground">{r.instructor_name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) =>
        r.category_name ? (
          <Badge variant="secondary" className="font-medium">
            {r.category_name}
          </Badge>
        ) : (
          '—'
        ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (r) => <span className="capitalize text-foreground">{r.level || '—'}</span>,
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
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.status === 'published' ? (
          <Badge>Published</Badge>
        ) : (
          <Badge variant="secondary">Draft</Badge>
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
            aria-label="Edit course"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          >
            <Edit className="h-4 w-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteConfirm(r)}
            aria-label="Delete course"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Courses" value={statsLoading ? '—' : stats.total} icon={<BookOpen className="h-5 w-5" />} />
        <StatsCard label="Active Drafts" value={statsLoading ? '—' : stats.drafts} icon={<FileEdit className="h-5 w-5" />} />
        <StatsCard label="Instructors" value={statsLoading ? '—' : stats.instructors} icon={<GraduationCap className="h-5 w-5" />} />
        <StatsCard
          label="Avg. Duration"
          value={statsLoading ? '—' : `${Math.round(stats.avgDuration)} min`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
          {(['all', 'published', 'draft'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tab === t ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab(t)}
              className="capitalize"
            >
              {t === 'all' ? 'All Courses' : t === 'published' ? 'Published' : 'Drafts'}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setFilterOpen((v) => !v)} className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>
      {filterOpen ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap gap-4 pt-6">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category ID</Label>
              <Input
                className="w-[min(100%,12rem)]"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level</Label>
              <Select
                value={level || LEVEL_FILTER_ANY}
                onValueChange={(v) => setLevel(!v || v === LEVEL_FILTER_ANY ? '' : v)}
              >
                <SelectTrigger className="w-[min(100%,12rem)]">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LEVEL_FILTER_ANY}>Any</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
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
          <div className="space-y-2">
            <Label>
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Course title"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Short description</Label>
            <Textarea
              value={courseShortDescription}
              onChange={(e) => setCourseShortDescription(e.target.value)}
              className="min-h-[88px] resize-y"
              placeholder="Brief summary for listings"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={courseCategoryId || CATEGORY_NONE}
                onValueChange={(v) => setCourseCategoryId(!v || v === CATEGORY_NONE ? '' : v)}
                disabled={categoriesLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_NONE}>— None —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={courseLevel} onValueChange={(v) => setCourseLevel(v ?? 'beginner')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create course'}
            </Button>
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
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{' '}
          <strong className="text-foreground">{deleteConfirm?.title}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="destructive" type="button" onClick={() => deleteConfirm && handleDeleteCourse(deleteConfirm)}>
            Delete
          </Button>
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
