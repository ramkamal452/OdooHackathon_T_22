'use client';

import DashboardHeader from '@/components/DashboardHeader';
import DashboardStats from '@/components/DashboardStats';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { BookOpen, Edit, Layers, Plus, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface InstructorRow {
  id: number;
  title: string;
  status?: string;
  is_published?: boolean;
  enrollment_count?: number;
  enrollments_count?: number;
}

interface InstructorDashboard {
  total_courses: number;
  total_enrollments: number;
  total_completed: number;
  total_in_progress?: number;
  in_progress?: number;
  courses: InstructorRow[];
}

export default function InstructorDashboardPage() {
  const [data, setData] = useState<InstructorDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get<InstructorDashboard>('/api/dashboard/instructor/');
      setData(d);
    } catch {
      setData({ total_courses: 0, total_enrollments: 0, total_completed: 0, courses: [] });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <DashboardHeader
        title="Instructor Dashboard"
        subtitle="Manage your courses and track enrollments."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/instructor/content"><Layers className="mr-1.5 h-4 w-4" />Content Manager</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/instructor/courses/new"><Plus className="mr-1.5 h-4 w-4" />Create course</Link>
            </Button>
          </div>
        }
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
                { label: 'Total courses', value: data.total_courses, icon: <BookOpen className="h-5 w-5" /> },
                { label: 'Total enrollments', value: data.total_enrollments, icon: <Users className="h-5 w-5" /> },
                { label: 'Completed', value: data.total_completed, icon: <TrendingUp className="h-5 w-5" /> },
                {
                  label: 'In progress',
                  value: data.total_in_progress ?? data.in_progress ?? Math.max(0, data.total_enrollments - data.total_completed),
                  icon: <Layers className="h-5 w-5" />,
                },
              ]}
            />

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Enrollments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>
                        {c.status === 'published' || c.is_published ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.enrollment_count ?? c.enrollments_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/instructor/courses/${c.id}/edit`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" />Edit
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.courses.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-4 text-lg font-medium">No courses yet</p>
                  <p className="mt-1 text-muted-foreground">Create your first course to get started.</p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/instructor/courses/new"><Plus className="mr-2 h-4 w-4" />Create Course</Link>
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
