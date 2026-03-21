'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate } from '@/lib/admin-format';
import { fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useCallback, useEffect, useState } from 'react';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  course_count?: number;
  created_at?: string;
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
  const [editRow, setEditRow] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryRow | null>(null);

  useEffect(() => {
    setHeader({
      title: 'Course Categories',
      subtitle: 'Organize courses with categories and slugs.',
      searchPlaceholder: 'Search categories…',
      primaryActionLabel: '+ New Category',
      onPrimaryAction: () => { setEditRow(null); setName(''); setModalOpen(true); },
    });
  }, [setHeader]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage<CategoryRow>('/api/admin/categories/', { page, search });
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadTable(); }, [loadTable]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editRow) {
        await api.put(`/api/categories/${editRow.id}/`, { name });
        toast('Category updated!', 'success');
      } else {
        await api.post('/api/categories/', { name });
        toast('Category created!', 'success');
      }
      setModalOpen(false);
      setEditRow(null);
      setName('');
      loadTable();
    } catch {
      toast('Failed to save category', 'error');
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

  function openEdit(row: CategoryRow) {
    setEditRow(row);
    setName(row.name);
    setModalOpen(true);
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-500 dark:text-gray-400">CAT-{r.id}</span>,
    },
    {
      key: 'name',
      header: 'Category Name',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </span>
          <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (r) => <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-400">{r.slug}</code>,
    },
    {
      key: 'course_count',
      header: 'Courses',
      render: (r) => <span className="tabular-nums font-medium">{r.course_count ?? 0}</span>,
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
          <button type="button" onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400" aria-label="Edit">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button type="button" onClick={() => setDeleteConfirm(r)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400" aria-label="Delete">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No categories found." />
        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="categories" />
      </div>
      <aside className="glass-card h-fit border border-dashed border-blue-200/50 p-6 dark:border-blue-500/20">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Summary</p>
        <p className="mt-2 text-3xl font-semibold text-blue-600 dark:text-blue-400">{loading ? '—' : total}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total Categories</p>
      </aside>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditRow(null); }} title={editRow ? 'Edit Category' : 'Create Category'} subtitle={editRow ? `Editing "${editRow.name}"` : 'Add a new course category.'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="glass-input mt-1 w-full" placeholder="e.g. Web Development" autoFocus />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <button type="button" onClick={() => { setModalOpen(false); setEditRow(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editRow ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Category" subtitle="This action cannot be undone." size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{deleteConfirm?.name}</strong>?</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:from-rose-600 hover:to-rose-700">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
