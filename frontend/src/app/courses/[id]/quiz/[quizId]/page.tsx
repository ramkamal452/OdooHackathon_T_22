'use client';

import QuizPlayer, { QuizResultState } from '@/components/QuizPlayer';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { QuizDetail, QuizQuestion, api } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function parseAttemptResult(
  data: unknown,
  questions: QuizQuestion[],
  answers: { question_id: number; option_id: number }[]
): QuizResultState {
  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const score = Number(obj.score ?? 0);
  const totalMarks = Number(obj.total_marks ?? 0);
  const percentage = Number(obj.percentage ?? 0);
  const isPassed = Boolean(obj.is_passed);
  const answersRaw = Array.isArray(obj.answers) ? obj.answers : [];

  const perQuestion = questions.map((q) => {
    const ans = answers.find((a) => a.question_id === q.id);
    const selectedOptionId = ans?.option_id ?? 0;
    const row = answersRaw.find(
      (a: { question_id?: number }) => Number((a as { question_id: number }).question_id) === q.id
    ) as { selected_option_id?: number; is_correct?: boolean; marks_awarded?: number } | undefined;
    const correct = row
      ? Boolean(row.is_correct)
      : (q.options || []).find((o) => o.id === selectedOptionId)?.is_correct ?? false;
    return { questionId: q.id, correct, selectedOptionId, marksAwarded: row?.marks_awarded };
  });

  const pointsEarned = Number(obj.points_earned ?? 0);
  const totalPoints = obj.total_points != null ? Number(obj.total_points) : undefined;
  return { score, totalMarks, percentage, isPassed, pointsEarned, totalPoints, perQuestion, raw: data };
}

export default function QuizPage() {
  const params = useParams();
  const courseId = String(params.id);
  const quizId = String(params.quizId);

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<QuizDetail>(`/api/quizzes/${quizId}/`);
      setQuiz(data);
    } catch {
      setError('Quiz not found.');
      setQuiz(null);
    } finally { setLoading(false); }
  }, [quizId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(answers: { question_id: number; option_id: number }[]): Promise<QuizResultState> {
    const { data } = await api.post<unknown>(`/api/quizzes/${quizId}/attempt/`, { answers });
    return parseAttemptResult(data, quiz?.questions ?? [], answers);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md">
          <h2 className="text-lg font-semibold text-foreground mb-2">Quiz Unavailable</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This quiz may have been removed, or you may not have permission to access it.
          </p>
          <Button asChild>
            <Link href={`/courses/${courseId}`}>Back to Course</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader
        title={quiz.title}
        subtitle={quiz.description || 'Quiz'}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/courses/${courseId}`}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to course</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <QuizPlayer questions={quiz.questions || []} onSubmit={handleSubmit} />
        </div>
      </div>
    </>
  );
}
