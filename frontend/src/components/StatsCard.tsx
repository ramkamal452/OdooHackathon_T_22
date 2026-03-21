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
      ? 'border-emerald-100'
      : variant === 'warning'
        ? 'border-amber-100'
        : 'border-blue-100';

  return (
    <div
      className={`rounded-xl border border-dashed ${variantRing} bg-white px-4 py-4 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        {icon ? <span className="text-blue-600">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#1e40af]">
        {value}
      </p>
      {trend ? (
        <p
          className={`mt-1 text-xs font-medium ${
            trend.positive ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {trend.value}
        </p>
      ) : null}
    </div>
  );
}
