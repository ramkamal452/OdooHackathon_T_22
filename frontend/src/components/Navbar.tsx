'use client';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserProfileDropdown } from '@/components/UserProfileDropdown';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
} from 'lucide-react';
import { useState } from 'react';

function userInitials(first?: string, last?: string, email?: string) {
  const f = first?.trim();
  const l = last?.trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

const navLinks = [
  { href: '/courses', label: 'Courses', icon: BookOpen },
];

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/logo.png" alt="Learnova" width={40} height={40} className="h-10 w-10 rounded-lg object-contain" />
            <span className="text-lg font-bold tracking-tight">Learnova</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant={isActive(link.href) ? 'secondary' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href={link.href}>
                  <link.icon className="mr-1.5 h-4 w-4" />
                  {link.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <>
              <div className="hidden items-center gap-1 md:flex">
                <Button
                  variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                {user.role === 'admin' && (
                  <Button
                    variant={isActive('/admin') ? 'secondary' : 'ghost'}
                    size="sm"
                    asChild
                  >
                    <Link href="/admin">
                      <Shield className="mr-1.5 h-4 w-4" />
                      Admin
                    </Link>
                  </Button>
                )}
              </div>

              <UserProfileDropdown />
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-4 pt-4">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <Image src="/logo/logo.png" alt="Learnova" width={40} height={40} className="h-10 w-10 rounded-lg object-contain" />
                  <span className="text-lg font-bold">Learnova</span>
                </Link>
                <Separator />
                {navLinks.map((link) => (
                  <Button key={link.href} variant="ghost" className="justify-start" asChild>
                    <Link href={link.href} onClick={() => setMobileOpen(false)}>
                      <link.icon className="mr-2 h-4 w-4" />
                      {link.label}
                    </Link>
                  </Button>
                ))}
                {user && (
                  <>
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </Button>
                    {user.role === 'admin' && (
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/admin" onClick={() => setMobileOpen(false)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Admin
                        </Link>
                      </Button>
                    )}
                  </>
                )}
                <Separator />
                {!user && !loading && (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" asChild>
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/register" onClick={() => setMobileOpen(false)}>Get Started</Link>
                    </Button>
                  </div>
                )}
                {user && (
                  <Button variant="destructive" onClick={() => { logout(); setMobileOpen(false); }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
