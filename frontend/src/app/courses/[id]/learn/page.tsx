'use client';

import LessonList from '@/components/LessonList';
import ProgressBar from '@/components/ProgressBar';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CourseDetail, LessonItem, api, mediaUrl, unwrapList } from '@/lib/api';
import QuizPlayer from '@/components/QuizPlayer';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, CheckCircle2, ChevronRight, Download, Lock, Paperclip } from 'lucide-react';
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
  const [textContent, setTextContent] = useState('');
  const [textLoaded, setTextLoaded] = useState(false);

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

  useEffect(() => {
    setTextContent('');
    setTextLoaded(false);
    if (!lesson) return;
    const resUrl = lesson.resource_url || '';
    const vidUrl = lesson.video_url || '';
    const url = resUrl || vidUrl;
    if (!url) return;
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    const needsFetch = ['txt', 'text', 'log', 'json', 'xml', 'yaml', 'yml', 'csv', 'md', 'markdown'].includes(ext);
    if (needsFetch) {
      const fullUrl = url.startsWith('http') ? url : url;
      fetch(fullUrl)
        .then((r) => r.ok ? r.text() : Promise.reject())
        .then((t) => { setTextContent(t); setTextLoaded(true); })
        .catch(() => setTextLoaded(true));
    }
  }, [lesson]);

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
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Course Unavailable</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This course may have been removed, or you may not have permission to view it.
          </p>
          <Button asChild>
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
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
  let videoSrc = lesson.video_url || '';
  const allAttachments = (lesson.attachments || []).map((att) => ({
    ...att,
    href: att.file_url || att.file || att.external_url || att.url || '#',
  }));

  if (!videoSrc) {
    const vidAtt = allAttachments.find((a) => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(a.href));
    if (vidAtt) videoSrc = vidAtt.href;
  }

  const isDirectVideo = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(videoSrc);
  const isEmbed = /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.com/i.test(videoSrc);
  const audioExtRegex = /\.(mp3|wav|ogg|aac|flac|m4a|wma)(\?|$)/i;
  const isDirectAudio = lesson.content_type === 'audio' || audioExtRegex.test(videoSrc) || audioExtRegex.test(resource || '');
  const audioSrc = isDirectAudio ? (videoSrc || resource || '') : '';

  const fileExt = (resource || videoSrc || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
  const isPdf = fileExt === 'pdf' || lesson.content_type === 'pdf';
  const isImage = lesson.content_type === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'].includes(fileExt);
  const isCsv = fileExt === 'csv';
  const isMarkdown = ['md', 'markdown'].includes(fileExt);
  const isText = ['txt', 'text', 'log', 'json', 'xml', 'yaml', 'yml'].includes(fileExt) || lesson.content_type === 'text';
  const isDocx = ['doc', 'docx'].includes(fileExt);
  const isExcel = ['xls', 'xlsx'].includes(fileExt);

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
              <CardContent className="p-6 space-y-4">
                                {lesson.is_locked ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                      <Lock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">This content is locked</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      You need to complete the previous lesson or quiz before you can access this part of the course.
                    </p>
                    <Button variant="outline" className="mt-6" asChild>
                      <Link href={`/courses/${courseId}`}>View Course Overview</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* QUIZ: QuizPlayer component */}
                    {lesson.content_type === 'quiz' && (
                      <QuizPlayer
                        questions={lesson.questions || []}
                        onSubmit={async (answersArray) => {
                          const { data } = await api.post<any>(
                            `/api/quizzes/${lesson.id}/attempt/`,
                            { answers: answersArray }
                          );
                          const mappedRes: any = {
                            score: data.score,
                            totalMarks: data.total_marks,
                            percentage: data.percentage,
                            isPassed: data.is_passed,
                            pointsEarned: data.points_earned,
                            totalPoints: data.total_points,
                            perQuestion: (data.answers || []).map((a: any) => ({
                              questionId: a.question_id,
                              correct: a.is_correct,
                              selectedOptionId: a.selected_option_id,
                              marksAwarded: a.marks_awarded,
                            })),
                            raw: data,
                          };
                          if (data.is_passed) {
                            await load();
                          }
                          return mappedRes;
                        }}
                      />
                    )}

                    {/* VIDEO: direct S3 or Embed */}
                    {(lesson.content_type === 'video' || (videoSrc && isDirectVideo)) && videoSrc && !isDirectAudio && (
                      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                        {isDirectVideo ? (
                          <video
                            key={videoSrc}
                            controls
                            controlsList={lesson.allow_download ? undefined : 'nodownload'}
                            className="h-full w-full"
                            preload="metadata"
                          >
                            <source src={videoSrc} />
                            Your browser does not support the video tag.
                          </video>
                        ) : isEmbed ? (
                          <iframe
                            title={lesson.title}
                            src={videoSrc.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            key={videoSrc}
                            controls
                            className="h-full w-full"
                            preload="metadata"
                          >
                            <source src={videoSrc} />
                          </video>
                        )}
                      </div>
                    )}

                    {/* AUDIO: mp3/wav/ogg/aac */}
                    {isDirectAudio && audioSrc && (
                      <div className="rounded-lg border bg-muted/50 p-6 space-y-3">
                        <p className="text-sm font-medium text-foreground">Audio Player</p>
                        <audio
                          key={audioSrc}
                          controls
                          className="w-full"
                          preload="metadata"
                        >
                          <source src={audioSrc} />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}

                    {/* IMAGE: jpg/png/gif/webp/svg from S3 */}
                    {isImage && resource && (
                      <div className="space-y-3">
                        <div className="flex justify-center rounded-lg border bg-muted/50 p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resource}
                            alt={lesson.title}
                            className="max-h-[600px] max-w-full rounded-lg object-contain"
                          />
                        </div>
                        {lesson.allow_download && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" asChild>
                              <a href={resource} target="_blank" rel="noreferrer" download>
                                <Download className="mr-1.5 h-4 w-4" />Download Image
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PDF: inline viewer with iframe */}
                    {isPdf && resource && !isImage && (
                      <div className="space-y-3">
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted">
                          <iframe title={lesson.title} src={resource} className="h-full w-full" />
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <a href={resource} target="_blank" rel="noreferrer" download>
                              <Download className="mr-1.5 h-4 w-4" />Download PDF
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* CSV: parse and render as table */}
                    {isCsv && textLoaded && textContent && (
                      <div className="space-y-3">
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-sm">
                            {textContent.split('\n').filter(Boolean).map((row, ri) => {
                              const cells = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
                              const Tag = ri === 0 ? 'th' : 'td';
                              return (
                                <tr key={ri} className={ri === 0 ? 'bg-muted font-medium' : 'border-t'}>
                                  {cells.map((cell, ci) => (
                                    <Tag key={ci} className="px-3 py-2 text-left">{cell}</Tag>
                                  ))}
                                </tr>
                              );
                            })}
                          </table>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <a href={resource || videoSrc} target="_blank" rel="noreferrer" download>
                              <Download className="mr-1.5 h-4 w-4" />Download CSV
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* MARKDOWN: render as formatted text */}
                    {isMarkdown && textLoaded && textContent && (
                      <div className="space-y-3">
                        <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border bg-card p-6">
                          <pre className="whitespace-pre-wrap font-sans">{textContent}</pre>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <a href={resource || videoSrc} target="_blank" rel="noreferrer" download>
                              <Download className="mr-1.5 h-4 w-4" />Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* TEXT/JSON/XML/TXT: display as preformatted */}
                    {isText && !isCsv && !isMarkdown && (
                      <div className="space-y-3">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <pre className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-4 text-sm">
                            {textLoaded ? (textContent || lesson.content_body || 'No content') : lesson.content_body || ''}
                          </pre>
                        </div>
                        {resource && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" asChild>
                              <a href={resource} target="_blank" rel="noreferrer" download>
                                <Download className="mr-1.5 h-4 w-4" />Download
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DOCX / EXCEL: download + Google Docs viewer fallback */}
                    {(isDocx || isExcel) && resource && (
                      <div className="space-y-3">
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted">
                          <iframe
                            title={lesson.title}
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resource)}`}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" asChild>
                            <a href={resource} target="_blank" rel="noreferrer" download>
                              <Download className="mr-1.5 h-4 w-4" />Download {isDocx ? 'Document' : 'Spreadsheet'}
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* GENERIC DOCUMENT (content_type === 'document') with no special extension: show body + download */}
                    {lesson.content_type === 'document' && !isPdf && !isImage && !isCsv && !isMarkdown && !isText && !isDocx && !isExcel && !isDirectAudio && (
                      <div className="space-y-3">
                        {lesson.content_body && (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <p className="whitespace-pre-wrap">{lesson.content_body}</p>
                          </div>
                        )}
                        {resource && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={resource} target="_blank" rel="noreferrer">View File</a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={resource} target="_blank" rel="noreferrer" download>
                                <Download className="mr-1.5 h-4 w-4" />Download
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* LINK type */}
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

                    {/* Fallback: body text when nothing else matched and there is content */}
                    {!lesson.content_type && lesson.content_body && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <p className="whitespace-pre-wrap">{lesson.content_body}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            {allAttachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Attachments</h4>
                {allAttachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{att.title}</span>
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            )}

            {!lesson.is_locked && (
              <div className="mt-6 flex flex-wrap gap-3">
                {lesson.content_type !== 'quiz' && (
                  <Button
                    onClick={markComplete}
                    disabled={pending || !!completedMap.get(lesson.id)}
                    variant={completedMap.get(lesson.id) ? 'secondary' : 'default'}
                  >
                    {completedMap.get(lesson.id) ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />Completed</>
                    ) : pending ? 'Saving…' : 'Mark complete'}
                  </Button>
                )}
                <Button variant="outline" onClick={nextLesson} disabled={!hasNext || (hasNext && sortedLessons[currentIdx + 1].is_locked)}>
                  Next lesson<ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
