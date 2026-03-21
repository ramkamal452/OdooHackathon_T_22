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
      <div className="rounded-xl border border-dashed border-blue-100 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-[#1e40af]">Quiz results</h3>
        <div className="mt-2 space-y-1">
          <p className="text-lg text-[#2563eb]">
            Score: {result.score}
            {result.totalMarks ? ` / ${result.totalMarks}` : ''}
          </p>
          {result.percentage !== undefined && (
            <p className="text-sm text-gray-700">{Math.round(result.percentage)}% correct</p>
          )}
          {result.isPassed !== undefined && (
            <p
              className={`text-sm font-medium ${result.isPassed ? 'text-emerald-700' : 'text-rose-700'}`}
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
                  ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {qu.question_text}
                </p>
                <p className="mt-1 text-sm">
                  {ok ? (
                    <span className="text-emerald-700">Correct</span>
                  ) : (
                    <span className="text-rose-700">Incorrect</span>
                  )}
                  {pq?.marksAwarded !== undefined && (
                    <span className="ml-2 text-gray-600">({pq.marksAwarded} marks)</span>
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
    return <p className="text-gray-600">No questions in this quiz.</p>;
  }

  return (
    <div className="rounded-xl border border-dashed border-blue-100 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">
        Question {step + 1} of {sorted.length}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-900">{q.question_text}</h3>
      <div className="mt-4 space-y-2">
        {(q.options || []).map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
              selected[q.id] === opt.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={selected[q.id] === opt.id}
              onChange={() => setSelected((prev) => ({ ...prev, [q.id]: opt.id }))}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800">{opt.option_text}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!selected[q.id]}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Next
          </button>
        )}
        {isLast && (
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={submitting || !selected[q.id]}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        )}
      </div>
    </div>
  );
}
