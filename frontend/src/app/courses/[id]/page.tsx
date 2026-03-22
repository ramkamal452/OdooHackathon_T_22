'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
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
  CheckCircle2,
  CreditCard,
  Edit,
  Play,
  Search,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

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
  const [lessonSearch, setLessonSearch] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

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

  const reviews = useMemo(() => (course?.reviews ?? []) as CourseReview[], [course]);
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const tags = useMemo(() => {
    const t = (course as unknown as { tags?: string })?.tags;
    if (!t) return [];
    return t.split(',').map((s: string) => s.trim()).filter(Boolean);
  }, [course]);

  async function enroll() {
    if (!user) { router.push('/login'); return; }
    setActionLoading(true);
    try { await api.post(`/api/courses/${id}/enroll/`); await load(); }
    catch { setError('Could not enroll. Try again.'); }
    finally { setActionLoading(false); }
  }

  async function handleBuyCourse() {
    setPaymentOpen(false);
    await enroll();
  }

  async function handleCompleteCourse() {
    setCompleteOpen(false);
    setActionLoading(true);
    try {
      await api.post(`/api/courses/${id}/enroll/`);
      await load();
    } catch { /* already enrolled, just refresh */ await load(); }
    finally { setActionLoading(false); }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      await api.post(`/api/courses/${id}/reviews/`, {
        rating: reviewRating,
        review_text: reviewText,
      });
      setReviewSuccess(true);
      setReviewText('');
      setReviewRating(5);
      await load();
    } catch {
      setError('Could not submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Course Unavailable</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This course may have been removed, or you may not have permission to view it.
          </p>
          <Button asChild>
            <Link href="/courses"><ArrowLeft className="mr-2 h-4 w-4" />Browse Courses</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const thumb = mediaUrl(course.thumbnail);
  const enrollmentStatus = course.enrollment_status;
  const enrolled = !!enrollment || (!!enrollmentStatus && enrollmentStatus !== 'not_enrolled' && enrollmentStatus !== 'owner');
  const isOwner = enrollmentStatus === 'owner';
  const progressPct = enrollment?.progress_percent ?? (stats.total ? Math.round((stats.done / stats.total) * 100) : 0);
  const allDone = stats.total > 0 && stats.done === stats.total;
  const accessRule = (course as unknown as { access_rule?: string }).access_rule;
  const price = (course as unknown as { price?: number | string }).price;
  const isPaid = accessRule === 'payment' && !enrolled && !isOwner;
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
              <Button size="sm" asChild>
                <Link href={user?.role === 'admin' ? `/admin/courses/${id}/edit` : `/dashboard/instructor/courses/${id}/edit`}>
                  <Edit className="mr-1.5 h-4 w-4" />Edit
                </Link>
              </Button>
            ) : isPaid ? (
              <Button size="sm" onClick={() => user ? setPaymentOpen(true) : router.push(`/login?redirect=/courses/${id}`)} disabled={actionLoading}>
                <CreditCard className="mr-1.5 h-4 w-4" />Buy Course {price ? `— $${price}` : ''}
              </Button>
            ) : !enrolled ? (
              <Button size="sm" onClick={() => user ? enroll() : router.push(`/login?redirect=/courses/${id}`)} disabled={actionLoading}>
                {actionLoading ? 'Enrolling…' : !user ? 'Login to Enroll' : 'Enroll Now'}
              </Button>
            ) : (
              <Button size="sm" asChild><Link href={`/courses/${id}/learn`}><Play className="mr-1.5 h-4 w-4" />Continue</Link></Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(course.category?.name || course.category_name) && (
                <Badge variant="outline">{course.category?.name || course.category_name}</Badge>
              )}
              {course.level && <Badge variant="outline" className="capitalize">{course.level}</Badge>}
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
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
                {enrolled && allDone && (
                  <Button className="mt-4 w-full" onClick={() => setCompleteOpen(true)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete this course
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Curriculum</h2>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search lessons…"
                    value={lessonSearch}
                    onChange={(e) => setLessonSearch(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4">
                {modules.length > 0 ? (
                  <LessonList modules={modules} onSelect={onSelectLesson} completedMap={completedMap} searchQuery={lessonSearch} />
                ) : (
                  <Card className="p-8 text-center"><p className="text-muted-foreground">No modules yet.</p></Card>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">Reviews</h2>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({reviews.length})</span>
                  </div>
                )}
              </div>

              {user && enrolled && (
                <Card className="mt-4 p-5">
                  <form onSubmit={submitReview} className="space-y-3">
                    <Label className="text-sm font-medium">Write a review</Label>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setReviewRating(i + 1)}
                          className="p-0.5"
                        >
                          <Star className={`h-5 w-5 transition-colors ${i < reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'}`} />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your experience…"
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit" size="sm" disabled={reviewSubmitting}>
                        {reviewSubmitting ? 'Submitting…' : 'Submit Review'}
                      </Button>
                      {reviewSuccess && <span className="text-xs text-emerald-600 dark:text-emerald-400">Review saved!</span>}
                    </div>
                  </form>
                </Card>
              )}

              <div className="mt-4 space-y-4">
                {reviews.map((r) => (
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
                {reviews.length === 0 && (
                  <p className="text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
                )}
              </div>
            </div>
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

      <AlertDialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purchase Course</AlertDialogTitle>
            <AlertDialogDescription>
              This course requires payment. Complete the purchase to start learning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-3xl font-bold">{price ? `$${price}` : 'Paid'}</p>
              <p className="text-sm text-muted-foreground">{course.title}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Card Number</Label>
              <Input placeholder="4242 4242 4242 4242" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Expiry</Label>
                <Input placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">CVC</Label>
                <Input placeholder="123" />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <AlertDialogAction onClick={handleBuyCourse}>
              Pay {price ? `$${price}` : ''} & Enroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Congratulations! You&apos;ve finished all lessons. Mark this course as completed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Not yet</Button>
            <AlertDialogAction onClick={handleCompleteCourse}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Complete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
