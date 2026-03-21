'use client';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string | number;
}

export default function DataTable<T extends object>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found.',
  getRowKey,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/20 bg-white/70 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/70 px-6 py-16 text-center text-sm text-gray-500 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:shadow-black/20">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/20 bg-white/70 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 bg-white/50 dark:border-white/5 dark:bg-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={
                getRowKey
                  ? getRowKey(row, index)
                  : 'id' in row && (row as { id?: number | string }).id != null
                    ? String((row as { id: number | string }).id)
                    : index
              }
              className="border-b border-white/10 transition hover:bg-white/50 dark:border-white/5 dark:hover:bg-white/5"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-4 text-sm text-gray-800 dark:text-gray-200 ${col.className ?? ''}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
