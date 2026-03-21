'use client';

import { Card, CardContent } from '@/components/ui/card';

interface Stat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
}

interface DashboardStatsProps {
  stats: Stat[];
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-4 p-6">
            {s.icon && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {s.icon}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              {s.trend && <p className="text-xs text-muted-foreground">{s.trend}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
