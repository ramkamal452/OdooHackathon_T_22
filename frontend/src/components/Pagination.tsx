'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'items',
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pages: number[] = [];
  const windowSize = 5;
  let from = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const to = Math.min(totalPages, from + windowSize - 1);
  if (to - from + 1 < windowSize) {
    from = Math.max(1, to - windowSize + 1);
  }
  for (let p = from; p <= to; p++) pages.push(p);

  if (totalPages <= 1 && totalItems === 0) {
    return (
      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing 0 of 0 {itemName}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {start}–{end} of {totalItems} {itemName}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-md border border-white/20 bg-white/50 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`min-w-[2.25rem] rounded-md px-3 py-1.5 text-sm font-medium transition ${
              p === currentPage
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/30'
                : 'border border-white/20 bg-white/50 text-gray-700 hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-md border border-white/20 bg-white/50 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
        >
          Next
        </button>
      </div>
    </div>
  );
}
