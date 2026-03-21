'use client';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'warning' | 'success';
}

export default function StatsCard({
  label,
  value,
  icon,
  trend,
  variant = 'default',
}: StatsCardProps) {
  const variantRing =
    variant === 'success'
      ? 'border-emerald-200/80 dark:border-emerald-500/30'
      : variant === 'warning'
        ? 'border-amber-200/80 dark:border-amber-500/30'
        : 'border-white/20 dark:border-white/10';

  return (
    <div
      className={`rounded-2xl border bg-white/70 px-5 py-5 shadow-lg shadow-black/5 backdrop-blur-xl dark:bg-white/5 dark:shadow-black/20 ${variantRing}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {icon ? <span className="text-blue-500 dark:text-blue-400">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      {trend ? (
        <p
          className={`mt-1 text-xs font-medium ${
            trend.positive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {trend.value}
        </p>
      ) : null}
    </div>
  );
}
