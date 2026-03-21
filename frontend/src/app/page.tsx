'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const cardClass =
  'rounded-xl border border-dashed border-blue-100 bg-white p-6 text-left shadow-sm';

const btnPrimary =
  'inline-flex rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700';

const btnSecondary =
  'inline-flex rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-gray-50">
      <section className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Learn smarter with <span className="text-[#2563eb]">Learnova</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            Structured courses, engaging lessons, and quizzes that reinforce what you learn — all in
            one calm, focused experience.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/courses" className={btnPrimary}>
              Browse Courses
            </Link>
            <Link href="/register" className={btnSecondary}>
              Get Started
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-8 sm:grid-cols-3">
          <div className={cardClass}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-[#2563eb]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1e40af]">For Learners</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-900">
              Track progress, complete lessons, and test your knowledge with quizzes.
            </p>
          </div>
          <div className={cardClass}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-[#2563eb]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1e40af]">For Instructors</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-900">
              Publish courses, manage lessons, and see how learners engage.
            </p>
          </div>
          <div className={cardClass}>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-[#2563eb]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#1e40af]">Built for Focus</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-900">
              Clean typography, blue accents, and a layout that stays out of your way.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-8">
        <p className="text-center text-sm text-gray-600">© 2024 Learnova LMS</p>
      </footer>
    </div>
  );
}
