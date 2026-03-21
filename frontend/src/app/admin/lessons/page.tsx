'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
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

const PAGE_SIZE = 10;

function ContentIcon({ type }: { type: string }) {
  const common = 'h-4 w-4 shrink-0 text-blue-600';
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

export default function AdminLessonsPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [modules, setModules] = useState<{ id: number; title: string }[]>([]);

  useEffect(() => {
    setHeader({
      title: 'Lesson Inventory',
      subtitle: 'All lessons across modules and courses.',
      searchPlaceholder: 'Search lessons…',
      primaryActionLabel: '+ Add Lesson',
      onPrimaryAction: () => {},
    });
  }, [setHeader]);

  useEffect(() => {
    (async () => {
      const data = await fetchPage<{ id: number; title: string }>('/api/admin/courses/', { page: 1 });
      setCourses(data.results.map((c) => ({ id: c.id, title: c.title })));
    })();
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

  const columns: Column<LessonRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">#LS-{r.id}</span>,
    },
    {
      key: 'title',
      header: 'Lesson Title',
      render: (r) => <span className="font-medium text-blue-600">{r.title}</span>,
    },
    {
      key: 'module',
      header: 'Module Title',
      render: (r) => (
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {r.module_title}
        </span>
      ),
    },
    {
      key: 'content_type',
      header: 'Content Type',
      render: (r) => (
        <div className="flex items-center gap-2 capitalize text-gray-800">
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
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            YES
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            NO
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: () => (
        <div className="flex items-center gap-2 text-gray-500">
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-blue-600" aria-label="View">
            <EyeIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-blue-600" aria-label="Edit">
            <PencilIcon />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Course</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Module</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Content</label>
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
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
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => loadTable()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
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
    </div>
  );
}
