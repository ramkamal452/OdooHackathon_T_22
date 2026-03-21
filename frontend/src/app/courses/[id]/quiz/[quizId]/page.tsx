'use client';

import QuizPlayer, { QuizResultState } from '@/components/QuizPlayer';
import { QuizDetail, QuizQuestion, api } from '@/lib/api';
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
    ) as
      | {
          selected_option_id?: number;
          is_correct?: boolean;
          marks_awarded?: number;
        }
      | undefined;
    const correct = row
      ? Boolean(row.is_correct)
      : (q.options || []).find((o) => o.id === selectedOptionId)?.is_correct ?? false;
    return {
      questionId: q.id,
      correct,
      selectedOptionId,
      marksAwarded: row?.marks_awarded,
    };
  });

  return { score, totalMarks, percentage, isPassed, perQuestion, raw: data };
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
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(
    answers: { question_id: number; option_id: number }[]
  ): Promise<QuizResultState> {
    const { data } = await api.post<unknown>(`/api/quizzes/${quizId}/attempt/`, {
      answers,
    });
    const qs = quiz?.questions ?? [];
    return parseAttemptResult(data, qs, answers);
  }

  if (loading) {
    return (
      <div className="surface-bg flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="surface-bg mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-rose-500 dark:text-rose-400">{error || 'Unavailable'}</p>
        <Link
          href={`/courses/${courseId}`}
          className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Back to course
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen surface-bg">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${courseId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to course
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
        {quiz.description ? (
          <p className="mt-2 text-gray-600 dark:text-gray-400">{quiz.description}</p>
        ) : null}
        <div className="mt-8">
          <QuizPlayer questions={quiz.questions || []} onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
