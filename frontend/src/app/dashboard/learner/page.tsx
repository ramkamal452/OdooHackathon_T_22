'use client';

import CourseCard from '@/components/CourseCard';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardStats from '@/components/DashboardStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Badge as BadgeType, CourseListItem, PointLedgerEntry, api, unwrapList } from '@/lib/api';
import { Award, BookOpen, TrendingUp, Trophy, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface LearnerDashboard {
  enrolled_courses?: number;
  in_progress?: number;
  completed?: number;
  total_points?: number;
  enrollments?: Array<{
    course_id: number;
    course_title: string;
    progress_percent?: number;
    status?: string;
  }>;
}

export default function LearnerDashboardPage() {
  const [data, setData] = useState<LearnerDashboard | null>(null);
  const [badges, setBadges] = useState<{ badge: BadgeType; awarded_at: string }[]>([]);
  const [points, setPoints] = useState<PointLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get<LearnerDashboard>('/api/dashboard/learner/');
      setData(d);
    } catch {
      setData({ enrolled_courses: 0, in_progress: 0, completed: 0, total_points: 0, enrollments: [] });
    }
    try {
      const { data: b } = await api.get<unknown>('/api/my/badges/');
      setBadges(unwrapList(b));
    } catch { setBadges([]); }
    try {
      const { data: p } = await api.get<unknown>('/api/my/points/');
      setPoints(unwrapList<PointLedgerEntry>(p));
    } catch { setPoints([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <DashboardHeader
        title="Learner Dashboard"
        subtitle="Pick up where you left off."
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        {loading || !data ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-10">
            <DashboardStats
              stats={[
                { label: 'Enrolled courses', value: data.enrolled_courses ?? data.enrollments?.length ?? 0, icon: <BookOpen className="h-5 w-5" /> },
                { label: 'In progress', value: data.in_progress ?? 0, icon: <TrendingUp className="h-5 w-5" /> },
                { label: 'Completed', value: data.completed ?? 0, icon: <Trophy className="h-5 w-5" /> },
                { label: 'Total points', value: data.total_points ?? 0, icon: <Zap className="h-5 w-5" /> },
              ]}
            />

            {badges.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold">Your Badges</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {badges.map((b) => (
                    <Card key={b.badge.id} className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{b.badge.name}</p>
                        <p className="text-xs text-muted-foreground">{b.badge.description}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {points.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Point Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {points.slice(0, 10).map((p, i) => (
                    <div key={p.id}>
                      {i > 0 && <Separator />}
                      <div className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className="text-sm font-medium">{p.reason || p.source_type_label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={p.points >= 0 ? 'default' : 'destructive'}>
                          {p.points >= 0 ? '+' : ''}{p.points}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="text-xl font-semibold">Your Courses</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {(data.enrollments ?? []).map((en, idx) => {
                  const courseObj: CourseListItem = {
                    id: en.course_id,
                    title: en.course_title,
                    short_description: '',
                  };
                  return (
                    <CourseCard
                      key={idx}
                      course={courseObj}
                      href={`/courses/${en.course_id}`}
                      progress={en.progress_percent}
                    />
                  );
                })}
              </div>
              {(data.enrollments ?? []).length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-4 text-lg font-medium">No courses yet</p>
                  <p className="mt-1 text-muted-foreground">Start your learning journey today.</p>
                  <Button asChild className="mt-4">
                    <Link href="/courses">Browse Courses</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
