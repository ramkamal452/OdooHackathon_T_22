'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import {
  CourseDetail,
  LessonItem,
  QuizListItem,
  api,
  mediaUrl,
  unwrapList,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface EnrollmentRow {
  id: number;
  course_id?: number;
  course_title?: string;
  status?: string;
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

export default function CourseDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { user } = useAuth();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<CourseDetail>(`/api/courses/${id}/`);
      setCourse(data);

      try {
        const { data: qd } = await api.get<unknown>(`/api/quizzes/course/${id}/`);
        setQuizzes(unwrapList<QuizListItem>(qd));
      } catch {
        setQuizzes([]);
      }

      if (user) {
        try {
          const { data: mine } = await api.get<unknown>('/api/enrollments/my/');
          const rows = unwrapList<EnrollmentRow>(mine);
          const cid = Number(id);
          const match = rows.find((r) => r.course_id === cid);
          setEnrollment(match ?? null);
        } catch {
          setEnrollment(null);
        }
      } else {
        setEnrollment(null);
      }
    } catch {
      setError('Course not found or unavailable.');
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const completedMap = useMemo(() => {
    const m = new Map<number, boolean>();
    if (!course?.modules) return m;
    for (const mod of course.modules) {
      mod.lessons?.forEach((l) => {
        if (l.is_completed !== undefined) m.set(l.id, l.is_completed);
      });
    }
    return m;
  }, [course]);

  const stats = useMemo(() => {
    const lessons = course ? flattenLessons(course.modules) : [];
    const total = lessons.length;
    let done = 0;
    lessons.forEach((l) => {
      if (completedMap.get(l.id)) done += 1;
    });
    return { total, done, remaining: total - done };
  }, [course, completedMap]);

  const instructorName = useMemo(() => {
    if (!course) return '';
    if (course.instructor_name) return course.instructor_name;
    if (course.instructor) {
      const fn = [course.instructor.first_name, course.instructor.last_name]
        .filter(Boolean)
        .join(' ');
      return fn || course.instructor.email || 'Instructor';
    }
    return 'Instructor';
  }, [course]);

  async function enroll() {
    if (!user) {
      router.push('/login');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/api/courses/${id}/enroll/`);
      await load();
    } catch {
      setError('Could not enroll. Try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-bg flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="surface-bg mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-rose-500 dark:text-rose-400">{error || 'Not found'}</p>
        <Link
          href="/courses"
          className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Back to courses
        </Link>
      </div>
    );
  }

  const thumb = mediaUrl(course.thumbnail);
  const enrollmentStatus = course.enrollment_status;
  const enrolled =
    !!enrollment || (!!enrollmentStatus && enrollmentStatus !== 'not_enrolled' && enrollmentStatus !== 'owner');
  const isOwner = enrollmentStatus === 'owner';
  const progressPct =
    enrollment?.progress_percent ??
    (stats.total ? Math.round((stats.done / stats.total) * 100) : 0);

  const onSelectLesson = (lesson: LessonItem) => {
    router.push(`/courses/${id}/learn?lesson=${lesson.id}`);
  };

  const modules = course.modules || [];

  return (
    <div className="min-h-screen surface-bg">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="glass-card overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
          <div className="relative aspect-[21/9] min-h-[200px] bg-gray-100 dark:bg-gray-800 md:aspect-[3/1]">
            {thumb ? (
              <>
                <Image src={thumb} alt="" fill className="object-cover" priority sizes="100vw" />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
                  aria-hidden
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-50 text-blue-300 dark:from-gray-800 dark:via-gray-900 dark:to-slate-900 dark:text-blue-400/50">
                <span className="text-lg font-medium">No thumbnail</span>
              </div>
            )}
          </div>
          <div className="p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{instructorName}</p>
              {course.category?.name || course.category_name ? (
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                  {course.category?.name || course.category_name}
                </span>
              ) : null}
              {course.level ? (
                <span className="rounded-full border border-white/20 bg-white/50 px-2 py-0.5 text-xs font-medium capitalize text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-300">
                  {course.level}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{course.title}</h1>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-gray-600 dark:text-gray-400">
              {course.description || course.short_description}
            </p>

            {enrolled && (
              <div className="mt-8 max-w-xl">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your progress</p>
                <ProgressBar value={progressPct} className="mt-2" />
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4">
              {isOwner ? (
                <Link href={`/dashboard/instructor/courses/${id}/edit`} className="btn-primary">
                  Edit course
                </Link>
              ) : !enrolled ? (
                <button type="button" onClick={enroll} disabled={actionLoading} className="btn-primary disabled:opacity-60">
                  {actionLoading ? 'Enrolling…' : 'Enroll'}
                </button>
              ) : (
                <Link href={`/courses/${id}/learn`} className="btn-primary">
                  Continue learning
                </Link>
              )}
              <Link href="/courses" className="btn-secondary">
                All courses
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Lessons', value: stats.total },
                { label: 'Completed', value: stats.done },
                { label: 'Remaining', value: stats.remaining },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-xl px-4 py-4 text-center">
                  <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{s.value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Curriculum</h2>
            <div className="glass-card mt-4 p-4">
              {modules.length > 0 ? (
                <LessonList
                  modules={modules}
                  onSelect={onSelectLesson}
                  completedMap={completedMap}
                />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-500">No modules yet.</p>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Quizzes</h2>
            <ul className="mt-4 space-y-3">
              {quizzes.map((q) => (
                <li key={q.id} className="glass-card flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{q.title}</p>
                    {q.question_count != null ? (
                      <p className="text-xs text-gray-500 dark:text-gray-500">{q.question_count} questions</p>
                    ) : null}
                  </div>
                  <Link href={`/courses/${id}/quiz/${q.id}`} className="btn-primary px-3 py-1.5 text-sm">
                    Take quiz
                  </Link>
                </li>
              ))}
              {quizzes.length === 0 && (
                <li className="text-sm text-gray-500 dark:text-gray-500">No quizzes for this course yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
