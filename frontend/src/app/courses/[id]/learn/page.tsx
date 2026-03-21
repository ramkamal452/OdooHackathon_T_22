'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import { CourseDetail, LessonItem, api, mediaUrl, unwrapList } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
      if (targetId && !lessons.find((l) => l.id === targetId)) {
        targetId = lessons[0]?.id;
      }
      if (targetId) {
        const { data: ld } = await api.get<LessonItem>(`/api/lessons/${targetId}/`);
        setLesson(ld);
        if (!lessonParam || Number(lessonParam) !== targetId) {
          router.replace(`/courses/${courseId}/learn?lesson=${targetId}`);
        }
      } else {
        setLesson(null);
      }

      if (user) {
        try {
          const { data: mine } = await api.get<unknown>('/api/enrollments/my/');
          const rows = unwrapList<EnrollmentRow>(mine);
          const cid = Number(courseId);
          const match = rows.find((r) => r.course_id === cid);
          setEnrollment(match ?? null);
          if (match?.progress_percent != null) setServerProgress(match.progress_percent);
        } catch {
          setEnrollment(null);
        }
      }
    } catch {
      setError('Could not load lesson.');
      setCourse(null);
      setLesson(null);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonParam, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  const completedMap = useMemo(() => {
    const m = new Map<number, boolean>();
    course?.modules?.forEach((mod) => {
      mod.lessons?.forEach((l) => {
        if (l.is_completed !== undefined) m.set(l.id, l.is_completed);
      });
    });
    return m;
  }, [course]);

  const sortedLessons = useMemo(
    () => flattenLessons(course?.modules ?? []),
    [course]
  );

  const progressPct = useMemo(() => {
    if (serverProgress != null) return Math.round(serverProgress);
    if (enrollment?.progress_percent != null) return Math.round(enrollment.progress_percent);
    const total = sortedLessons.length;
    if (!total) return 0;
    let done = 0;
    sortedLessons.forEach((l) => {
      if (completedMap.get(l.id)) done += 1;
    });
    return Math.round((done / total) * 100);
  }, [sortedLessons, completedMap, enrollment, serverProgress]);

  async function markComplete() {
    if (!lesson) return;
    setPending(true);
    try {
      const { data } = await api.post<{ progress_percent?: number }>(
        `/api/lessons/${lesson.id}/complete/`,
        {}
      );
      if (typeof data?.progress_percent === 'number') {
        setServerProgress(data.progress_percent);
      }
      await load();
    } catch {
      setError('Could not mark complete.');
    } finally {
      setPending(false);
    }
  }

  function selectLesson(l: LessonItem) {
    router.push(`/courses/${courseId}/learn?lesson=${l.id}`);
  }

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
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="p-8 text-center text-rose-600">
        {error}
        <div className="mt-4">
          <Link href={`/courses/${courseId}`} className="text-[#2563eb] hover:underline">
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  if (!course || !lesson) {
    return (
      <div className="p-8 text-center text-gray-600">
        <p>No lessons in this course yet.</p>
        <Link href={`/courses/${courseId}`} className="mt-4 inline-block text-[#2563eb] hover:underline">
          Back to course
        </Link>
      </div>
    );
  }

  const resource = mediaUrl(lesson.resource_url);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-gray-200 bg-white p-4 lg:w-80 lg:border-b-0 lg:border-r">
          <Link
            href={`/courses/${courseId}`}
            className="text-sm font-medium text-[#2563eb] hover:text-blue-700"
          >
            ← Back to course
          </Link>
          <h2 className="mt-4 line-clamp-2 text-lg font-semibold text-[#1e40af]">{course.title}</h2>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Progress</p>
            <ProgressBar value={progressPct} className="mt-1" />
          </div>
          <div className="mt-6 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <LessonList
              modules={course.modules || []}
              currentLessonId={lesson.id}
              onSelect={selectLesson}
              completedMap={completedMap}
            />
          </div>
        </aside>

        <div className="flex-1 p-4 sm:p-8">
          <h1 className="text-2xl font-bold text-[#1e40af]">{lesson.title}</h1>

          <div className="mt-8 rounded-xl border border-dashed border-blue-100 bg-white p-6 shadow-sm">
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
              <div className="prose prose-sm max-w-none text-gray-800">
                <p className="whitespace-pre-wrap">{lesson.content_body}</p>
              </div>
            )}
            {lesson.content_type === 'pdf' && resource && (
              <div>
                <a
                  href={resource}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#2563eb] hover:underline"
                >
                  Open PDF
                </a>
              </div>
            )}
            {lesson.content_type === 'link' && (
              <div className="space-y-2">
                {resource ? (
                  <a
                    href={resource}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#2563eb] hover:underline"
                  >
                    {resource}
                  </a>
                ) : null}
                {lesson.content_body ? (
                  <p className="whitespace-pre-wrap text-gray-700">{lesson.content_body}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={markComplete}
              disabled={pending || !!completedMap.get(lesson.id)}
              className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {completedMap.get(lesson.id) ? 'Completed' : pending ? 'Saving…' : 'Mark complete'}
            </button>
            <button
              type="button"
              onClick={nextLesson}
              disabled={!hasNext}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
            >
              Next lesson
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
