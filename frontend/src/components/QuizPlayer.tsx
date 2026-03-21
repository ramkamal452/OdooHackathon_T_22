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
  pointsEarned?: number;
  totalPoints?: number;
  perQuestion: {
    questionId: number;
    correct: boolean;
    selectedOptionId: number;
    marksAwarded?: number;
  }[];
  raw?: unknown;
}

const BADGE_TIERS = [
  { name: 'Newbie', min: 20 },
  { name: 'Explorer', min: 40 },
  { name: 'Achiever', min: 60 },
  { name: 'Specialist', min: 80 },
  { name: 'Expert', min: 100 },
  { name: 'Master', min: 120 },
];

function getNextBadge(points: number) {
  for (const tier of BADGE_TIERS) {
    if (points < tier.min) {
      return { name: tier.name, remaining: tier.min - points, min: tier.min };
    }
  }
  return null;
}

function getCurrentBadge(points: number) {
  let current = 'None';
  for (const tier of BADGE_TIERS) {
    if (points >= tier.min) current = tier.name;
  }
  return current;
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
            {result.pointsEarned != null && result.pointsEarned > 0 && (
              <div className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center">
                <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                  +{result.pointsEarned} points earned!
                </p>
                <p className="text-xs text-yellow-600/80 dark:text-yellow-400/60">
                  Points have been added to your profile
                </p>
              </div>
            )}
            {result.totalPoints != null && (
              <div className="mt-2 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Current rank: <span className="font-semibold text-foreground">{getCurrentBadge(result.totalPoints)}</span>
                </p>
                {getNextBadge(result.totalPoints) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {getNextBadge(result.totalPoints)!.remaining} more points to <span className="font-medium text-primary">{getNextBadge(result.totalPoints)!.name}</span>
                    </p>
                    <Progress value={(result.totalPoints / getNextBadge(result.totalPoints)!.min) * 100} className="h-1.5 max-w-xs mx-auto" />
                  </div>
                )}
                {!getNextBadge(result.totalPoints) && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">You&apos;ve reached the highest rank!</p>
                )}
              </div>
            )}
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
