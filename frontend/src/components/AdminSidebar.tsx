'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  Layers,
  LayoutDashboard,
  PieChart,
  Settings,
  Users,
} from 'lucide-react';
import { useState } from 'react';

const sidebarLinks = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: FolderOpen },
  { href: '/admin/courses', label: 'Courses', icon: BookOpen },
  { href: '/admin/modules', label: 'Modules', icon: Layers },
  { href: '/admin/lessons', label: 'Lessons', icon: FileText },
  { href: '/admin/enrollments', label: 'Enrollments', icon: ClipboardList },
  { href: '/admin/lesson-progress', label: 'Lesson Progress', icon: BarChart3 },
  { href: '/admin/quizzes', label: 'Quizzes', icon: HelpCircle },
  { href: '/admin/reporting', label: 'Reporting', icon: PieChart },
  { href: '/admin/content-manager', label: 'Content Manager', icon: LayoutDashboard },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
              <span className="text-[11px] font-medium text-muted-foreground">Admin Panel</span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="mx-auto">
            <Image src="/logo/logo.png" alt="Learnova" width={36} height={36} className="h-9 w-9 object-contain" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && 'mx-auto')}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
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

      <div className="p-2" />
    </aside>
  );
}
