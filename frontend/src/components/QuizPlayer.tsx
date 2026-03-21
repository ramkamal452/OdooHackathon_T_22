'use client';

import { QuizQuestion } from '@/lib/api';
import { useMemo, useState } from 'react';

export interface QuizResultState {
  score: number;
  totalMarks: number;
  percentage?: number;
  isPassed?: boolean;
  perQuestion: Array<{
    questionId: number;
    correct: boolean;
    selectedOptionId: number;
    marksAwarded?: number;
  }>;
  raw?: unknown;
}

interface QuizPlayerProps {
  questions: QuizQuestion[];
  onSubmit: (answers: { question_id: number; option_id: number }[]) => Promise<QuizResultState>;
}

export default function QuizPlayer({ questions, onSubmit }: QuizPlayerProps) {
  const sorted = useMemo(
    () => [...questions].sort((a, b) => a.sort_order - b.sort_order),
    [questions]
  );
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResultState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = sorted[step];
  const isLast = step >= sorted.length - 1;

  async function handleFinalSubmit() {
    setError(null);
    const missing = sorted.filter((qu) => !selected[qu.id]);
    if (missing.length) {
      setError('Please answer all questions before submitting.');
      return;
    }
    const payload = sorted.map((qu) => ({
      question_id: qu.id,
      option_id: selected[qu.id],
    }));
    setSubmitting(true);
    try {
      const res = await onSubmit(payload);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Quiz results</h3>
        <div className="mt-2 space-y-1">
          <p className="text-lg text-blue-600 dark:text-blue-400">
            Score: {result.score}
            {result.totalMarks ? ` / ${result.totalMarks}` : ''}
          </p>
          {result.percentage !== undefined && (
            <p className="text-sm text-gray-700 dark:text-gray-300">{Math.round(result.percentage)}% correct</p>
          )}
          {result.isPassed !== undefined && (
            <p
              className={`text-sm font-medium ${result.isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {result.isPassed ? 'Passed' : 'Not passed'}
            </p>
          )}
        </div>
        <ul className="mt-4 space-y-3">
          {sorted.map((qu, i) => {
            const pq = result.perQuestion.find((p) => p.questionId === qu.id);
            const ok = pq?.correct;
            return (
              <li
                key={qu.id}
                className={`rounded-lg border p-3 ${
                  ok
                    ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-rose-200/80 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {i + 1}. {qu.question_text}
                </p>
                <p className="mt-1 text-sm">
                  {ok ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Correct</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">Incorrect</span>
                  )}
                  {pq?.marksAwarded !== undefined && (
                    <span className="ml-2 text-gray-600 dark:text-gray-400">({pq.marksAwarded} marks)</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!q) {
    return <p className="text-gray-600 dark:text-gray-400">No questions in this quiz.</p>;
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Question {step + 1} of {sorted.length}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{q.question_text}</h3>
      <div className="mt-4 space-y-2">
        {(q.options || []).map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 px-3 py-2 transition dark:border-white/10 ${
              selected[q.id] === opt.id
                ? 'border-blue-500 bg-blue-500/10 dark:border-blue-400 dark:bg-blue-400/10'
                : 'hover:border-white/30 dark:hover:border-white/20'
            }`}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={selected[q.id] === opt.id}
              onChange={() => setSelected((prev) => ({ ...prev, [q.id]: opt.id }))}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:text-blue-400"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">{opt.option_text}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary">
            Back
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!selected[q.id]}
            className="btn-primary disabled:opacity-50"
          >
            Next
          </button>
        )}
        {isLast && (
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={submitting || !selected[q.id]}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        )}
      </div>
    </div>
  );
}
