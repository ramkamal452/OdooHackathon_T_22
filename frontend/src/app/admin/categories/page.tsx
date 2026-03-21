'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatRelativeAgo } from '@/lib/admin-format';
import { api, unwrapList } from '@/lib/api';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
  course_count?: number;
}

const PAGE_SIZE = 10;

export default function AdminCategoriesPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryRow | null>(null);

  useEffect(() => {
    setHeader({
      title: 'Categories',
      subtitle: 'Organize courses into categories.',
      searchPlaceholder: 'Search categories…',
      primaryActionLabel: '+ New Category',
      onPrimaryAction: () => {
        setEditingId(null);
        setCatName('');
        setModalOpen(true);
      },
    });
  }, [setHeader]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<unknown>('/api/admin/categories/', {
        params: { page, search: search || undefined, page_size: PAGE_SIZE },
      });
      if (data && typeof data === 'object' && 'results' in data) {
        const d = data as { count: number; results: CategoryRow[] };
        setRows(d.results);
        setTotal(d.count);
      } else {
        const arr = unwrapList<CategoryRow>(data);
        setRows(arr);
        setTotal(arr.length);
      }
    } catch {
      toast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = catName.trim();
    if (!name) {
      toast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/categories/${editingId}/`, { name });
        toast('Category updated!', 'success');
      } else {
        await api.post('/api/categories/', { name });
        toast('Category created!', 'success');
      }
      setModalOpen(false);
      setCatName('');
      setEditingId(null);
      loadTable();
    } catch {
      toast(editingId ? 'Failed to update category' : 'Failed to create category', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: CategoryRow) {
    try {
      await api.delete(`/api/categories/${row.id}/`);
      toast('Category deleted!', 'success');
      setDeleteConfirm(null);
      loadTable();
    } catch {
      toast('Failed to delete category', 'error');
    }
  }

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setCatName(row.name);
    setModalOpen(true);
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">#CAT-{r.id}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (r) => (
        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
          {r.slug}
        </span>
      ),
    },
    {
      key: 'courses',
      header: 'Courses',
      render: (r) => (
        <span className="text-gray-700 dark:text-gray-300">{r.course_count ?? '—'}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (r) => (
        <span className="text-gray-500 dark:text-gray-400">{formatRelativeAgo(r.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => startEdit(r)}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            aria-label="Edit category"
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
            aria-label="Delete category"
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard label="Total Categories" value={loading ? '—' : total} />
      </div>

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No categories found." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="categories"
      />

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setCatName('');
          setEditingId(null);
        }}
        title={editingId ? 'Edit Category' : 'New Category'}
        subtitle={editingId ? 'Update the category name.' : 'Create a new category for organizing courses.'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="glass-input mt-1 w-full"
              placeholder="e.g. Programming"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setCatName('');
                setEditingId(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete category"
        subtitle="This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <strong className="text-gray-900 dark:text-white">{deleteConfirm?.name}</strong>?
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
