'use client';

import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/lib/auth';
import { usePathname } from 'next/navigation';

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  if (isAdmin) {
    return <>{children}</>;
  }
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
