'use client';

import { useAdminPage } from '@/app/admin/AdminPageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminSettingsPage() {
  const { setHeader } = useAdminPage();

  useEffect(() => {
    setHeader({
      title: 'Settings',
      subtitle: 'Configure admin preferences.',
      searchPlaceholder: 'Search settings…',
    });
  }, [setHeader]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Admin Settings</CardTitle>
            <CardDescription>Configure your admin preferences here.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Admin settings will appear here.</p>
      </CardContent>
    </Card>
  );
}
