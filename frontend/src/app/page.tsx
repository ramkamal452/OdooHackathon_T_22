'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center surface-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden surface-bg">
      <div className="gradient-orb w-96 h-96 bg-blue-400 top-20 -left-48" />
      <div className="gradient-orb w-80 h-80 bg-purple-400 bottom-40 -right-40" />
      <div className="gradient-orb w-64 h-64 bg-cyan-300 top-1/2 left-1/3" />

      <section className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
            Learn smarter with{' '}
            <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-300">
              Learnova
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            Structured courses, engaging lessons, and quizzes that reinforce what you learn — all in
            one calm, focused experience.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/courses" className="btn-primary">
              Browse Courses
            </Link>
            <Link href="/register" className="btn-secondary">
              Get Started
            </Link>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-20 grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className="glass-card p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">For Learners</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Track progress, complete lessons, and test your knowledge with quizzes.
            </p>
          </div>
          <div className="glass-card p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">For Instructors</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Publish courses, manage lessons, and see how learners engage.
            </p>
          </div>
          <div className="glass-card p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Built for Focus</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Clean typography, blue accents, and a layout that stays out of your way.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3 text-center">
          <div className="glass-card p-6">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">500+</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Courses Available</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">10K+</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Active Learners</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">95%</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Completion Rate</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/20 dark:border-white/5 bg-white/50 dark:bg-white/5 py-8 backdrop-blur-sm">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">© 2026 Learnova LMS. All rights reserved.</p>
      </footer>
    </div>
  );
}
