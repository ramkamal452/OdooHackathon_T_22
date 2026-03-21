'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CourseDetail,
  CourseReview,
  LessonItem,
  QuizListItem,
  api,
  mediaUrl,
  unwrapList,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft,
  BookOpen,
  Edit,
  Play,
  Star,
} from 'lucide-react';
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
  const [thumbError, setThumbError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<CourseDetail>(`/api/courses/${id}/`);
      setCourse(data);
      try {
        const { data: qd } = await api.get<unknown>(`/api/quizzes/course/${id}/`);
        setQuizzes(unwrapList<QuizListItem>(qd));
      } catch { setQuizzes([]); }
      if (user) {
        try {
          const { data: mine } = await api.get<unknown>('/api/enrollments/my/');
          const rows = unwrapList<EnrollmentRow>(mine);
          setEnrollment(rows.find((r) => r.course_id === Number(id)) ?? null);
        } catch { setEnrollment(null); }
      } else { setEnrollment(null); }
    } catch {
      setError('Course not found or unavailable.');
      setCourse(null);
    } finally { setLoading(false); }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

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
    lessons.forEach((l) => { if (completedMap.get(l.id)) done += 1; });
    return { total, done, remaining: total - done };
  }, [course, completedMap]);

  const instructorName = useMemo(() => {
    if (!course) return '';
    if (course.instructor_name) return course.instructor_name;
    if (course.instructor) {
      const fn = [course.instructor.first_name, course.instructor.last_name].filter(Boolean).join(' ');
      return fn || course.instructor.email || 'Instructor';
    }
    return 'Instructor';
  }, [course]);

  async function enroll() {
    if (!user) { router.push('/login'); return; }
    setActionLoading(true);
    try { await api.post(`/api/courses/${id}/enroll/`); await load(); }
    catch { setError('Could not enroll. Try again.'); }
    finally { setActionLoading(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-destructive">{error || 'Not found'}</p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/courses"><ArrowLeft className="mr-2 h-4 w-4" />Back to courses</Link>
        </Button>
      </div>
    );
  }

  const thumb = mediaUrl(course.thumbnail);
  const enrollmentStatus = course.enrollment_status;
  const enrolled = !!enrollment || (!!enrollmentStatus && enrollmentStatus !== 'not_enrolled' && enrollmentStatus !== 'owner');
  const isOwner = enrollmentStatus === 'owner';
  const progressPct = enrollment?.progress_percent ?? (stats.total ? Math.round((stats.done / stats.total) * 100) : 0);
  const onSelectLesson = (lesson: LessonItem) => { router.push(`/courses/${id}/learn?lesson=${lesson.id}`); };
  const modules = course.modules || [];

  return (
    <>
      <DashboardHeader
        title={course.title}
        subtitle={instructorName}
        actions={
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Button size="sm" asChild><Link href={`/dashboard/instructor/courses/${id}/edit`}><Edit className="mr-1.5 h-4 w-4" />Edit</Link></Button>
            ) : !enrolled ? (
              <Button size="sm" onClick={enroll} disabled={actionLoading}>
                {actionLoading ? 'Enrolling…' : 'Enroll Now'}
              </Button>
            ) : (
              <Button size="sm" asChild><Link href={`/courses/${id}/learn`}><Play className="mr-1.5 h-4 w-4" />Continue</Link></Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(course.category?.name || course.category_name) && (
                <Badge variant="outline">{course.category?.name || course.category_name}</Badge>
              )}
              {course.level && <Badge variant="outline" className="capitalize">{course.level}</Badge>}
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              {course.description || course.short_description}
            </p>
          </div>
          <div>
            <Card className="overflow-hidden">
              <div className="aspect-video bg-muted">
                {thumb && !thumbError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" onError={() => setThumbError(true)} />
                ) : (
                  <div className="flex h-full items-center justify-center"><BookOpen className="h-10 w-10 text-muted-foreground/40" /></div>
                )}
              </div>
              <CardContent className="p-4">
                {enrolled && <ProgressBar value={progressPct} className="mb-4" />}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Lessons</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{stats.done}</p>
                    <p className="text-xs text-muted-foreground">Done</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{stats.remaining}</p>
                    <p className="text-xs text-muted-foreground">Left</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-xl font-semibold">Curriculum</h2>
              <div className="mt-4">
                {modules.length > 0 ? (
                  <LessonList modules={modules} onSelect={onSelectLesson} completedMap={completedMap} />
                ) : (
                  <Card className="p-8 text-center"><p className="text-muted-foreground">No modules yet.</p></Card>
                )}
              </div>
            </div>

            {(course.reviews ?? []).length > 0 && (
              <div>
                <h2 className="text-xl font-semibold">Reviews</h2>
                <div className="mt-4 space-y-4">
                  {(course.reviews as CourseReview[]).map((r) => (
                    <Card key={r.id} className="p-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {r.user_name?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{r.user_name}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{r.review_text}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold">Quizzes</h2>
            <div className="mt-4 space-y-3">
              {quizzes.map((q) => (
                <Card key={q.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    {q.question_count != null && (
                      <p className="text-xs text-muted-foreground">{q.question_count} questions</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/courses/${id}/quiz/${q.id}`}>Take quiz</Link>
                  </Button>
                </Card>
              ))}
              {quizzes.length === 0 && (
                <Card className="p-6 text-center"><p className="text-sm text-muted-foreground">No quizzes for this course yet.</p></Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
