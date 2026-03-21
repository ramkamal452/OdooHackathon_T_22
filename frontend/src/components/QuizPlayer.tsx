'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { type QuizQuestion } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Trophy, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export interface QuizResultState {
  score: number;
  totalMarks: number;
  percentage: number;
  isPassed: boolean;
  perQuestion: {
    questionId: number;
    correct: boolean;
    selectedOptionId: number;
    marksAwarded?: number;
  }[];
  raw?: unknown;
}

interface QuizPlayerProps {
  questions: QuizQuestion[];
  onSubmit: (
    answers: { question_id: number; option_id: number }[]
  ) => Promise<QuizResultState>;
}

export default function QuizPlayer({ questions, onSubmit }: QuizPlayerProps) {
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [result, setResult] = useState<QuizResultState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  function selectOption(questionId: number, optionId: number) {
    if (result) return;
    setAnswers((prev) => new Map(prev).set(questionId, optionId));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = sorted.map((q) => ({
        question_id: q.id,
        option_id: answers.get(q.id) ?? 0,
      }));
      const res = await onSubmit(payload);
      setResult(res);
    } catch {
      setError('Could not submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setAnswers(new Map());
    setError(null);
  }

  if (result) {
    return (
      <div className="space-y-6">
        <Card className={cn(result.isPassed ? 'border-emerald-500/30' : 'border-destructive/30')}>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full',
              result.isPassed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
            )}>
              {result.isPassed ? <Trophy className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(result.percentage)}%</p>
              <p className="text-muted-foreground">
                {result.score} / {result.totalMarks} marks
              </p>
            </div>
            <Badge variant={result.isPassed ? 'default' : 'destructive'}>
              {result.isPassed ? 'Passed' : 'Not Passed'}
            </Badge>
            <Progress value={result.percentage} className="h-2 max-w-xs" />
          </CardContent>
        </Card>

        {sorted.map((q, idx) => {
          const pq = result.perQuestion.find((r) => r.questionId === q.id);
          const selectedId = pq?.selectedOptionId;
          return (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium">{q.question_text}</CardTitle>
                  </div>
                  {pq?.correct ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {(q.options || []).map((opt) => {
                  const isSelected = opt.id === selectedId;
                  const isCorrect = opt.is_correct;
                  return (
                    <div
                      key={opt.id}
                      className={cn(
                        'rounded-lg border px-4 py-2.5 text-sm',
                        isCorrect && 'border-emerald-500/50 bg-emerald-500/5',
                        isSelected && !isCorrect && 'border-destructive/50 bg-destructive/5',
                        !isSelected && !isCorrect && 'border-border'
                      )}
                    >
                      {opt.option_text}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex justify-center">
          <Button onClick={reset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake Quiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sorted.map((q, idx) => (
        <Card key={q.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </span>
              <CardTitle className="text-base font-medium">{q.question_text}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {(q.options || []).map((opt) => {
              const isSelected = answers.get(q.id) === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectOption(q.id, opt.id)}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30 hover:bg-muted/50'
                  )}
                >
                  {opt.option_text}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {answers.size} / {sorted.length} answered
        </p>
        <Button onClick={handleSubmit} disabled={submitting || answers.size < sorted.length}>
          {submitting ? 'Submitting…' : 'Submit Quiz'}
        </Button>
      </div>
    </div>
  );
}
