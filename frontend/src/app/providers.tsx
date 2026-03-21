'use client';

import Navbar from '@/components/Navbar';
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
      <main className="min-h-[calc(100vh-3.5rem)] bg-gray-50">{children}</main>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
