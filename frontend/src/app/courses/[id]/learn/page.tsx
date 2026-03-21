'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CourseDetail, LessonItem, api, mediaUrl, unwrapList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface EnrollmentRow {
  id: number;
  course_id?: number;
  progress_percent?: number;
}

function flattenLessons(modules: CourseDetail['modules']): LessonItem[] {
  const sortedMods = [...(modules || [])].sort((a, b) => a.sort_order - b.sort_order);
  const out: LessonItem[] = [];
  for (const m of sortedMods) {
    const ls = [...(m.lessons || [])].sort((a, b) => a.sort_order - b.sort_order);
    out.push(...ls);
  }
  return out;
}

export default function LearnPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const courseId = String(params.id);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lesson, setLesson] = useState<LessonItem | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [serverProgress, setServerProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lessonParam = searchParams.get('lesson');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: c } = await api.get<CourseDetail>(`/api/courses/${courseId}/`);
      setCourse(c);
      const lessons = flattenLessons(c.modules);
      let targetId = lessonParam ? Number(lessonParam) : lessons[0]?.id;
      if (targetId && !lessons.find((l) => l.id === targetId)) targetId = lessons[0]?.id;
      if (targetId) {
        const { data: ld } = await api.get<LessonItem>(`/api/lessons/${targetId}/`);
        setLesson(ld);
        if (!lessonParam || Number(lessonParam) !== targetId) {
          router.replace(`/courses/${courseId}/learn?lesson=${targetId}`);
        }
      } else { setLesson(null); }
      if (user) {
        try {
          const { data: mine } = await api.get<unknown>('/api/enrollments/my/');
          const rows = unwrapList<EnrollmentRow>(mine);
          const match = rows.find((r) => r.course_id === Number(courseId));
          setEnrollment(match ?? null);
          if (match?.progress_percent != null) setServerProgress(match.progress_percent);
        } catch { setEnrollment(null); }
      }
    } catch {
      setError('Could not load lesson.');
      setCourse(null);
      setLesson(null);
    } finally { setLoading(false); }
  }, [courseId, lessonParam, user, router]);

  useEffect(() => { load(); }, [load]);

  const completedMap = useMemo(() => {
    const m = new Map<number, boolean>();
    course?.modules?.forEach((mod) => {
      mod.lessons?.forEach((l) => {
        if (l.is_completed !== undefined) m.set(l.id, l.is_completed);
      });
    });
    return m;
  }, [course]);

  const sortedLessons = useMemo(() => flattenLessons(course?.modules ?? []), [course]);

  const progressPct = useMemo(() => {
    if (serverProgress != null) return Math.round(serverProgress);
    if (enrollment?.progress_percent != null) return Math.round(enrollment.progress_percent);
    const total = sortedLessons.length;
    if (!total) return 0;
    let done = 0;
    sortedLessons.forEach((l) => { if (completedMap.get(l.id)) done += 1; });
    return Math.round((done / total) * 100);
  }, [sortedLessons, completedMap, enrollment, serverProgress]);

  async function markComplete() {
    if (!lesson) return;
    setPending(true);
    try {
      const { data } = await api.post<{ progress_percent?: number }>(`/api/lessons/${lesson.id}/complete/`, {});
      if (typeof data?.progress_percent === 'number') setServerProgress(data.progress_percent);
      await load();
    } catch { setError('Could not mark complete.'); }
    finally { setPending(false); }
  }

  function selectLesson(l: LessonItem) { router.push(`/courses/${courseId}/learn?lesson=${l.id}`); }

  function nextLesson() {
    if (!lesson) return;
    const idx = sortedLessons.findIndex((l) => l.id === lesson.id);
    const next = idx >= 0 ? sortedLessons[idx + 1] : undefined;
    if (next) router.push(`/courses/${courseId}/learn?lesson=${next.id}`);
  }

  const currentIdx = sortedLessons.findIndex((l) => lesson && l.id === lesson.id);
  const hasNext = currentIdx >= 0 && currentIdx < sortedLessons.length - 1;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Button variant="link" asChild className="mt-4">
          <Link href={`/courses/${courseId}`}>Back to course</Link>
        </Button>
      </div>
    );
  }

  if (!course || !lesson) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No lessons in this course yet.</p>
        <Button variant="link" asChild className="mt-4">
          <Link href={`/courses/${courseId}`}>Back to course</Link>
        </Button>
      </div>
    );
  }

  const resource = mediaUrl(lesson.resource_url);

  return (
    <>
      <DashboardHeader
        title={lesson.title}
        subtitle={course.title}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 flex-col border-r bg-card lg:flex">
          <div className="p-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/courses/${courseId}`}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to course</Link>
            </Button>
            <ProgressBar value={progressPct} className="mt-4" />
          </div>
          <Separator />
          <ScrollArea className="flex-1 p-2">
            <LessonList
              modules={course.modules || []}
              currentLessonId={lesson.id}
              onSelect={selectLesson}
              completedMap={completedMap}
            />
          </ScrollArea>
        </aside>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
            <Card>
              <CardContent className="p-6">
                {lesson.content_type === 'video' && lesson.video_url && (
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                    <iframe
                      title={lesson.title}
                      src={lesson.video_url}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {lesson.content_type === 'text' && (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap">{lesson.content_body}</p>
                  </div>
                )}
                {lesson.content_type === 'pdf' && resource && (
                  <Button variant="outline" asChild>
                    <a href={resource} target="_blank" rel="noreferrer">Open PDF</a>
                  </Button>
                )}
                {lesson.content_type === 'link' && (
                  <div className="space-y-2">
                    {resource && (
                      <Button variant="link" asChild className="p-0 h-auto">
                        <a href={resource} target="_blank" rel="noreferrer">{resource}</a>
                      </Button>
                    )}
                    {lesson.content_body && (
                      <p className="whitespace-pre-wrap text-muted-foreground">{lesson.content_body}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={markComplete}
                disabled={pending || !!completedMap.get(lesson.id)}
                variant={completedMap.get(lesson.id) ? 'secondary' : 'default'}
              >
                {completedMap.get(lesson.id) ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Completed</>
                ) : pending ? 'Saving…' : 'Mark complete'}
              </Button>
              <Button variant="outline" onClick={nextLesson} disabled={!hasNext}>
                Next lesson<ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
