'use client';

import DashboardHeader from '@/components/DashboardHeader';
import DashboardSidebar from '@/components/DashboardSidebar';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';

const AUTH_PAGES = ['/login', '/register'];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isAdmin = pathname?.startsWith('/admin') ?? false;
  const isDashboard = pathname?.startsWith('/dashboard') ?? false;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);
  const isHome = pathname === '/';

  if (isAdmin || isDashboard) {
    return <>{children}</>;
  }

  if (isAuthPage || (isHome && !user) || loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
