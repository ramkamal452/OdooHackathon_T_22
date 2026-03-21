'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  GraduationCap,
  Lightbulb,
  ArrowRight,
  Users,
  Award,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <Image src="/logo/logo.png" alt="Learnova" width={80} height={80} className="h-20 w-20 object-contain" priority />
            </div>
            <Badge variant="secondary" className="mb-6">
              <Zap className="mr-1.5 h-3 w-3" />
              Trusted by 10K+ learners worldwide
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Learn smarter with{' '}
              <span className="text-primary">Learnova</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Structured courses, engaging lessons, and quizzes that reinforce what you learn — all in
              one calm, focused experience.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/courses">
                  Browse Courses
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: 'For Learners',
              description: 'Track progress, complete lessons, and test your knowledge with quizzes.',
            },
            {
              icon: GraduationCap,
              title: 'For Instructors',
              description: 'Publish courses, manage lessons, and see how learners engage.',
            },
            {
              icon: Lightbulb,
              title: 'Built for Focus',
              description: 'Clean design, intuitive navigation, and a layout that stays out of your way.',
            },
          ].map((item) => (
            <Card key={item.title} className="group transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-3 text-center">
            {[
              { icon: BookOpen, value: '500+', label: 'Courses Available' },
              { icon: Users, value: '10K+', label: 'Active Learners' },
              { icon: Award, value: '95%', label: 'Completion Rate' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <stat.icon className="h-6 w-6 text-primary" />
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t bg-card py-8">
        <p className="text-center text-sm text-muted-foreground">
          &copy; 2026 Learnova LMS. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
