'use client';

import CourseCard from '@/components/CourseCard';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseListItem, api, unwrapList } from '@/lib/api';
import { Search } from 'lucide-react';
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
    <>
      <DashboardHeader
        title="Course Catalog"
        subtitle="Explore published courses and start learning at your own pace."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                className="w-64 pl-9"
              />
            </div>
            <Button size="sm" onClick={() => load()}>Search</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="mt-8 text-destructive">{error}</p>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium">No courses found</p>
            <p className="mt-1 text-muted-foreground">Try adjusting your search terms</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} href={`/courses/${c.id}`} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
