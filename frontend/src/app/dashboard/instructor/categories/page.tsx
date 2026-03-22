'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, unwrapList } from '@/lib/api';
import { Edit, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
  course_count?: number;
}

export default function InstructorCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryRow | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<unknown>('/api/categories/', {
        params: { search: search || undefined },
      });
      const arr = unwrapList<CategoryRow>(data);
      setRows(arr);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = catName.trim();
    if (!name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/categories/${editingId}/`, { name });
        toast.success('Category updated!');
      } else {
        await api.post('/api/categories/', { name });
        toast.success('Category created!');
      }
      closeModal();
      loadCategories();
    } catch {
      toast.error(editingId ? 'Failed to update category' : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: CategoryRow) {
    try {
      await api.delete(`/api/categories/${row.id}/`);
      toast.success('Category deleted!');
      setDeleteConfirm(null);
      loadCategories();
    } catch {
      toast.error('Failed to delete category');
    }
  }

  function openCreate() {
    setEditingId(null);
    setCatName('');
    setModalOpen(true);
  }

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setCatName(row.name);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setCatName('');
    setEditingId(null);
  }

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize courses into categories. Instructors can create new categories here.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <FolderOpen className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {loading ? '—' : rows.length} Total Categories
        </span>
      </div>

      {/* Search */}
      <Input
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Courses</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No categories found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-mono text-xs">{row.slug}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.course_count ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(row)} aria-label="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(row)}
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Category' : 'New Category'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the category name.' : 'Create a new category for organizing courses.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Programming"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
