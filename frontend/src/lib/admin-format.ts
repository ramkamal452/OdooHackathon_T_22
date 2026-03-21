export function initialsFromName(first?: string, last?: string, email?: string): string {
  const f = (first || '').trim();
  const l = (last || '').trim();
  if (f || l) {
    return ((f[0] || '') + (l[0] || f[1] || '')).toUpperCase().slice(0, 2) || '?';
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatRelativeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function parsePageFromUrl(nextOrPrev: string | null): number | null {
  if (!nextOrPrev) return null;
  try {
    const u = new URL(nextOrPrev, 'http://x');
    const p = u.searchParams.get('page');
    return p ? parseInt(p, 10) : null;
  } catch {
    return null;
  }
}
