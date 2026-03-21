'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate, initialsFromName, type PaginatedResponse } from '@/lib/admin-format';
import { countActiveUsers, fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Activity, GraduationCap, Users, UserPlus } from 'lucide-react';
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
    } finally { setStatsLoading(false); }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<AdminUserRow>>('/api/auth/users/', { params: { page, search } });
      setRows(data.results);
      setTotal(data.count);
    } finally { setLoading(false); }
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
    } finally { setSaving(false); }
  }

  const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
    admin: 'default',
    instructor: 'secondary',
    learner: 'outline',
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => {
        const prefix = r.role === 'admin' ? 'ADM' : r.role === 'instructor' ? 'INS' : 'LRN';
        return <span className="font-mono text-muted-foreground">#{prefix}-{r.id}</span>;
      },
    },
    {
      key: 'name',
      header: 'Full Name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {initialsFromName(r.first_name, r.last_name, r.email)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">
            {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}
          </span>
        </div>
      ),
    },
    { key: 'email', header: 'Email Address' },
    {
      key: 'role',
      header: 'Role',
      render: (r) => (
        <Badge variant={roleVariants[r.role] || 'outline'} className="capitalize">
          {r.role}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => r.is_active ? (
        <Badge variant="default" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />Active
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />Inactive
        </Badge>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total Users" value={statsLoading ? '—' : stats.total} icon={<Users className="h-5 w-5" />} />
        <StatsCard label="Active Now" value={statsLoading ? '—' : stats.active} icon={<Activity className="h-5 w-5" />} variant="success" />
        <StatsCard label="Instructors" value={statsLoading ? '—' : stats.instructors} icon={<GraduationCap className="h-5 w-5" />} />
        <StatsCard label="Learners" value={statsLoading ? '—' : stats.learners} icon={<UserPlus className="h-5 w-5" />} />
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No users match your search." />
      <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemName="users" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New User" subtitle="Add a new user to the platform.">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="John" />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input required value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v ?? 'learner' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="learner">Learner</SelectItem>
                <SelectItem value="instructor">Instructor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input required type="password" minLength={8} value={form.password2} onChange={(e) => setForm((f) => ({ ...f, password2: e.target.value }))} placeholder="Repeat password" />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
