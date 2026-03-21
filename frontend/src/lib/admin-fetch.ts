import { api } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/admin-format';

export async function fetchPage<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<PaginatedResponse<T>> {
  const clean: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') clean[k] = String(v);
    });
  }
  const { data } = await api.get<PaginatedResponse<T>>(path, { params: clean });
  return data;
}

export async function countActiveUsers(search?: string): Promise<number> {
  let page = 1;
  let active = 0;
  while (true) {
    const data = await fetchPage<{ is_active: boolean }>('/api/auth/users/', {
      page,
      search,
    });
    active += data.results.filter((u) => u.is_active).length;
    if (!data.next) break;
    page += 1;
    if (page > 500) break;
  }
  return active;
}
