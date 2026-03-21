'use client';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { initialsFromName } from '@/lib/admin-format';

interface AdminHeaderProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  title: string;
  subtitle?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export default function AdminHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  title,
  subtitle,
  primaryActionLabel,
  onPrimaryAction,
}: AdminHeaderProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const initials = user
    ? initialsFromName(user.first_name, user.last_name, user.email)
    : '?';
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Admin';

  return (
    <header className="shrink-0 border-b border-white/20 dark:border-white/5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="relative max-w-xl flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="glass-input w-full rounded-full py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center justify-end gap-4">

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2 text-gray-500 transition hover:bg-white/50 dark:text-gray-400 dark:hover:bg-white/10"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-3 border-l border-white/20 dark:border-white/10 pl-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 dark:bg-blue-400/20 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{displayName}</p>
              <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{user?.role ?? 'admin'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-white/10 dark:border-white/5 px-4 py-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        {primaryActionLabel ? (
          <button type="button" onClick={onPrimaryAction} className="btn-primary inline-flex shrink-0 items-center justify-center">
            {primaryActionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
