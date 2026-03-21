'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatRelativeAgo } from '@/lib/admin-format';
import { api, unwrapList } from '@/lib/api';
import { Edit, FolderOpen, Trash2 } from 'lucide-react';
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
      onPrimaryAction: () => { setEditingId(null); setCatName(''); setModalOpen(true); },
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
    } catch { toast('Failed to load categories', 'error'); }
    finally { setLoading(false); }
  }, [page, search, toast]);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { loadTable(); }, [loadTable]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = catName.trim();
    if (!name) { toast('Name is required', 'error'); return; }
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
    } catch { toast(editingId ? 'Failed to update category' : 'Failed to create category', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(row: CategoryRow) {
    try {
      await api.delete(`/api/categories/${row.id}/`);
      toast('Category deleted!', 'success');
      setDeleteConfirm(null);
      loadTable();
    } catch { toast('Failed to delete category', 'error'); }
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
      render: (r) => <span className="font-mono text-muted-foreground">#CAT-{r.id}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (r) => <Badge variant="secondary" className="font-mono text-xs">{r.slug}</Badge>,
    },
    {
      key: 'courses',
      header: 'Courses',
      render: (r) => <span className="tabular-nums">{r.course_count ?? '—'}</span>,
    },
    {
      key: 'created',
      header: 'Created',
      render: (r) => <span className="text-muted-foreground">{formatRelativeAgo(r.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(r)} aria-label="Edit">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(r)} aria-label="Delete" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard label="Total Categories" value={loading ? '—' : total} icon={<FolderOpen className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No categories found." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="categories" />

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setCatName(''); setEditingId(null); }} title={editingId ? 'Edit Category' : 'New Category'} subtitle={editingId ? 'Update the category name.' : 'Create a new category for organizing courses.'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Programming" autoFocus />
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setCatName(''); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete category" subtitle="This action cannot be undone." size="sm">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong className="text-foreground">{deleteConfirm?.name}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
