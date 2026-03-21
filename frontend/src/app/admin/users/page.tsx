'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate, initialsFromName, type PaginatedResponse } from '@/lib/admin-format';
import { countActiveUsers, fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useCallback, useEffect, useState } from 'react';

interface AdminUserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined?: string;
}

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const { setHeader, search } = useAdminPage();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, instructors: 0, learners: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', password2: '', first_name: '', last_name: '', role: 'learner' });

  useEffect(() => {
    setHeader({
      title: 'Users Directory',
      subtitle: 'Manage platform accounts and roles.',
      searchPlaceholder: 'Search users by name or email…',
      primaryActionLabel: '+ New User',
      onPrimaryAction: () => setModalOpen(true),
    });
  }, [setHeader]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, inst, learn, active] = await Promise.all([
        fetchPage<AdminUserRow>('/api/auth/users/', { page: 1, search }),
        fetchPage<AdminUserRow>('/api/auth/users/', { page: 1, role: 'instructor', search }),
        fetchPage<AdminUserRow>('/api/auth/users/', { page: 1, role: 'learner', search }),
        countActiveUsers(search),
      ]);
      setStats({ total: all.count, active, instructors: inst.count, learners: learn.count });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<AdminUserRow>>('/api/auth/users/', { params: { page, search } });
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTable(); }, [loadTable]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/auth/register/', form);
      toast('User created successfully!', 'success');
      setModalOpen(false);
      setForm({ email: '', password: '', password2: '', first_name: '', last_name: '', role: 'learner' });
      loadTable();
      loadStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => {
        const prefix = r.role === 'admin' ? 'ADM' : r.role === 'instructor' ? 'INS' : 'LRN';
        return <span className="font-mono text-gray-500 dark:text-gray-400">#{prefix}-{r.id}</span>;
      },
    },
    {
      key: 'name',
      header: 'Full Name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-medium text-white shadow-sm">
            {initialsFromName(r.first_name, r.last_name, r.email)}
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}
          </span>
        </div>
      ),
    },
    { key: 'email', header: 'Email Address' },
    {
      key: 'role',
      header: 'Role',
      render: (r) => {
        const colors: Record<string, string> = {
          admin: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-400',
          instructor: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-400',
          learner: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400',
        };
        return (
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${colors[r.role] || colors.learner}`}>
            {r.role}
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) =>
        r.is_active ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-gray-500/20 bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-400/10 dark:bg-gray-400/10 dark:text-gray-400">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
            Inactive
          </span>
        ),
    },

  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Users" value={statsLoading ? '—' : stats.total} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
        <StatsCard label="Active Now" value={statsLoading ? '—' : stats.active} variant="success" />
        <StatsCard label="Instructors" value={statsLoading ? '—' : stats.instructors} />
        <StatsCard label="Learners" value={statsLoading ? '—' : stats.learners} />
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No users match your search." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="users" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New User" subtitle="Add a new user to the platform.">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
              <input required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="glass-input mt-1 w-full" placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
              <input required value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="glass-input mt-1 w-full" placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="glass-input mt-1 w-full" placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="glass-input mt-1 w-full">
              <option value="learner">Learner</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="glass-input mt-1 w-full" placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
              <input required type="password" minLength={8} value={form.password2} onChange={(e) => setForm((f) => ({ ...f, password2: e.target.value }))} className="glass-input mt-1 w-full" placeholder="Repeat password" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/10">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
