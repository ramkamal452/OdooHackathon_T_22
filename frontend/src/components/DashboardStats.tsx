interface StatItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

interface DashboardStatsProps {
  stats: StatItem[];
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-white/20 bg-white/70 px-5 py-5 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {s.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{s.value}</p>
            </div>
            {s.icon && (
              <div className="rounded-lg bg-white/50 p-2 text-blue-500 dark:bg-white/10 dark:text-blue-400">{s.icon}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
