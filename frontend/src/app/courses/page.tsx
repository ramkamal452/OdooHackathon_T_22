'use client';

import CourseCard from '@/components/CourseCard';
import { CourseListItem, api, unwrapList } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = search.trim() ? { search: search.trim() } : {};
      const { data } = await api.get<unknown>('/api/courses/', { params });
      setCourses(unwrapList<CourseListItem>(data));
    } catch {
      setError('Could not load courses.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1e40af]">Course Catalog</h1>
            <p className="mt-2 text-gray-600">
              Explore published courses and start learning at your own pace.
            </p>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-gray-100 px-4 py-2 ring-1 ring-gray-200/80">
              <input
                type="search"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                className="min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0"
              />
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="shrink-0 rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="mt-8 text-rose-600">{error}</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} href={`/courses/${c.id}`} />
            ))}
          </div>
        )}

        {!loading && !error && courses.length === 0 && (
          <p className="mt-12 text-center text-gray-500">No courses match your search.</p>
        )}
      </div>
    </div>
  );
}
