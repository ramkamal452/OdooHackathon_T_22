'use client';

import DataTable, { type Column } from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import StatsCard from '@/components/StatsCard';
import { useAdminPage } from '@/app/admin/AdminPageContext';
import { formatDate, initialsFromName, type PaginatedResponse } from '@/lib/admin-format';
import { countActiveUsers, fetchPage } from '@/lib/admin-fetch';
import { api } from '@/lib/api';
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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    instructors: 0,
    learners: 0,
  });

  useEffect(() => {
    setHeader({
      title: 'Users Directory',
      subtitle: 'Manage platform accounts and roles.',
      searchPlaceholder: 'Search users by name or email…',
      primaryActionLabel: '+ New Record',
      onPrimaryAction: () => {},
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
      setStats({
        total: all.count,
        active,
        instructors: inst.count,
        learners: learn.count,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [search]);

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<AdminUserRow>>('/api/auth/users/', {
        params: { page, search },
      });
      setRows(data.results);
      setTotal(data.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => <span className="font-mono text-gray-700">#LRN-{r.id}</span>,
    },
    {
      key: 'name',
      header: 'Full Name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
            {initialsFromName(r.first_name, r.last_name, r.email)}
          </div>
          <span className="font-medium text-gray-900">
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
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
          {r.role}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) =>
        r.is_active ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
            Inactive
          </span>
        ),
    },
    {
      key: 'date_joined',
      header: 'Created At',
      render: (r) => formatDate(r.date_joined),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Total Users"
          value={statsLoading ? '—' : stats.total}
        />
        <StatsCard
          label="Active Now"
          value={statsLoading ? '—' : stats.active}
        />
        <StatsCard
          label="Instructors"
          value={statsLoading ? '—' : stats.instructors}
        />
        <StatsCard
          label="Learners"
          value={statsLoading ? '—' : stats.learners}
        />
      </div>
      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No users match your search." />
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemName="users"
      />
    </div>
  );
}
