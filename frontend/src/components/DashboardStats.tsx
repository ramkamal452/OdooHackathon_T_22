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
          className="rounded-xl border border-dashed border-blue-100 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {s.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[#1e40af]">{s.value}</p>
            </div>
            {s.icon && (
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">{s.icon}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
