'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { useCallback, useEffect, useState } from 'react';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  course_count?: number;
  created_at?: string;
}

const PAGE_SIZE = 10;

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

export default function AdminCategoriesPage() {
  const { setHeader, search } = useAdminPage();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setHeader({
      title: 'Course Categories',
      subtitle: 'Organize courses with categories and slugs.',
      searchPlaceholder: 'Search categories…',
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
    });
  }, [setHeader]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage<CategoryRow>('/api/admin/categories/', {
        page,
        search,
      });
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<CategoryRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">CAT-{r.id}</span>,
    },
    {
      key: 'name',
      header: 'Category Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-blue-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </span>
          <span className="font-medium text-gray-900">{r.name}</span>
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', render: (r) => <span className="text-gray-600">{r.slug}</span> },
    {
      key: 'created_at',
      header: 'Created At',
      render: (r) => formatDate(r.created_at),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28',
      render: () => (
        <div className="flex items-center gap-2 text-gray-500">
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-blue-600" aria-label="Edit">
            <PencilIcon />
          </button>
          <button type="button" className="rounded p-1 hover:bg-gray-100 hover:text-rose-600" aria-label="Delete">
            <TrashIcon />
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          emptyMessage="No categories found."
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemName="categories"
        />
      </div>
      <aside className="h-fit rounded-xl border border-dashed border-blue-100 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Summary</p>
        <p className="mt-2 text-3xl font-semibold text-[#1e40af]">{loading ? '—' : total}</p>
        <p className="mt-1 text-sm text-gray-500">Total Categories</p>
      </aside>
    </div>
  );
}
