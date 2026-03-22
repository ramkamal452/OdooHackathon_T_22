'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen,
  ChevronLeft,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const learnerLinks: SidebarLink[] = [
  { href: '/dashboard/learner', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Browse Courses', icon: BookOpen },
];

const instructorLinks: SidebarLink[] = [
  { href: '/dashboard/instructor', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/instructor/courses/new', label: 'Create Course', icon: Plus },
  { href: '/dashboard/instructor/content', label: 'Content Manager', icon: Layers },
  { href: '/dashboard/instructor/categories', label: 'Categories', icon: FolderOpen },
  { href: '/courses', label: 'Browse Courses', icon: BookOpen },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const role = user?.role ?? 'learner';
  const links = role === 'instructor' ? instructorLinks : learnerLinks;
  const roleLabel = role === 'instructor' ? 'Instructor' : role === 'admin' ? 'Admin' : 'Learner';

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/logo/logo.png" alt="Learnova" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold tracking-tight text-foreground">Learnova</span>
              <span className="text-[11px] font-medium text-muted-foreground">{roleLabel}</span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="mx-auto">
            <Image src="/logo/logo.png" alt="Learnova" width={36} height={36} className="h-9 w-9 object-contain" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('h-7 w-7', collapsed && 'mx-auto')}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {links.map((link) => {
            const isActive =
              link.href === '/dashboard/learner' || link.href === '/dashboard/instructor'
                ? pathname === link.href
                : pathname === link.href || pathname?.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? link.label : undefined}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full text-destructive hover:text-destructive', collapsed ? 'justify-center px-2' : 'justify-start')}
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
