'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

export interface AdminHeaderConfig {
  title: string;
  subtitle?: string;
  searchPlaceholder: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

const defaultConfig: AdminHeaderConfig = {
  title: 'Admin',
  subtitle: '',
  searchPlaceholder: 'Search…',
};

interface AdminPageContextValue {
  search: string;
  setSearch: (v: string) => void;
  header: AdminHeaderConfig;
  setHeader: (c: Partial<AdminHeaderConfig>) => void;
  resetHeader: () => void;
}

const AdminPageContext = createContext<AdminPageContextValue | null>(null);

export function AdminPageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [header, setHeaderState] = useState<AdminHeaderConfig>(defaultConfig);

  useEffect(() => {
    setSearch('');
  }, [pathname]);

  const setHeader = useCallback((c: Partial<AdminHeaderConfig>) => {
    setHeaderState((prev) => ({ ...prev, ...c }));
  }, []);

  const resetHeader = useCallback(() => {
    setHeaderState(defaultConfig);
    setSearch('');
  }, []);

  const value = useMemo(
    () => ({
      search,
      setSearch,
      header,
      setHeader,
      resetHeader,
    }),
    [search, header, setHeader, resetHeader]
  );

  return (
    <AdminPageContext.Provider value={value}>{children}</AdminPageContext.Provider>
  );
}

export function useAdminPage(): AdminPageContextValue {
  const ctx = useContext(AdminPageContext);
  if (!ctx) throw new Error('useAdminPage must be used within AdminPageProvider');
  return ctx;
}
