'use client';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function userInitials(first?: string, last?: string, email?: string) {
  const f = first?.trim();
  const l = last?.trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 dark:border-white/5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            Learnova
          </Link>
          <Link
            href="/courses"
            className={`text-sm font-medium transition ${
              pathname === '/courses'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Courses
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2 text-gray-500 transition hover:bg-white/50 dark:hover:bg-white/10 dark:text-gray-400"
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
          {loading ? (
            <span className="text-sm text-gray-400 dark:text-gray-500">…</span>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className={`text-sm font-medium ${
                  pathname?.startsWith('/dashboard')
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium ${
                    pathname?.startsWith('/admin')
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 dark:bg-blue-400/20 text-xs font-semibold text-blue-600 dark:text-blue-400"
                  aria-hidden
                >
                  {userInitials(user.first_name, user.last_name, user.email)}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm text-gray-900 dark:text-white sm:inline">
                  {user.first_name || user.email}
                </span>
              </div>
              <button type="button" onClick={() => logout()} className="btn-primary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
