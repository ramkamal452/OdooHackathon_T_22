'use client';

import { useAuth } from '@/lib/auth';
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

const btnPrimary =
  'rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/95 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-[#1e40af]">
            Learnova
          </Link>
          <Link
            href="/courses"
            className={`text-sm font-medium transition ${
              pathname === '/courses' ? 'text-[#2563eb]' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Courses
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-sm text-gray-400">…</span>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className={`text-sm font-medium ${
                  pathname?.startsWith('/dashboard')
                    ? 'text-[#2563eb]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dashboard
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium ${
                    pathname?.startsWith('/admin') ? 'text-[#2563eb]' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
                  aria-hidden
                >
                  {userInitials(user.first_name, user.last_name, user.email)}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm text-gray-900 sm:inline">
                  {user.first_name || user.email}
                </span>
              </div>
              <button type="button" onClick={() => logout()} className={btnPrimary}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-gray-600 transition hover:text-[#2563eb]"
              >
                Login
              </Link>
              <Link href="/register" className={btnPrimary}>
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
