'use client';

import { useState } from 'react';
import { CourseListItem, mediaUrl } from '@/lib/api';
import Link from 'next/link';
import ProgressBar from './ProgressBar';

const Placeholder = () => (
  <div className="flex h-full items-center justify-center text-blue-200 dark:text-blue-500/40">
    <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v4H8v-4z" />
    </svg>
  </div>
);

interface CourseCardProps {
  course: CourseListItem;
  href: string;
  progress?: number;
}

export default function CourseCard({ course, href, progress }: CourseCardProps) {
  const thumb = mediaUrl(course.thumbnail);
  const [imgError, setImgError] = useState(false);
  const instructor =
    course.instructor_name ||
    (course.instructor
      ? [course.instructor.first_name, course.instructor.last_name].filter(Boolean).join(' ') ||
        course.instructor.email
      : 'Instructor');
  const lessons = course.lesson_count ?? 0;
  const desc =
    (course.short_description || course.description)?.slice(0, 120) || 'No description yet.';

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-white/70 shadow-lg shadow-black/5 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400/20 dark:shadow-black/20"
    >
      <div className="relative aspect-video w-full bg-gray-100 dark:bg-gray-800/50">
        {thumb && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
            onError={() => setImgError(true)}
          />
        ) : (
          <Placeholder />
        )}
        {progress !== undefined && progress >= 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 backdrop-blur-sm dark:bg-gray-900/80">
            <ProgressBar value={progress} showLabel />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 flex-1 text-lg font-semibold text-gray-900 transition group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {course.title}
          </h3>
          {course.level ? (
            <span className="shrink-0 rounded-full border border-white/20 bg-white/50 px-2 py-0.5 text-xs font-medium capitalize text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-300">
              {course.level}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-600 dark:text-gray-400">{desc}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{instructor}</span>
          <span>{lessons} lessons</span>
        </div>
        {course.category_name ? (
          <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">{course.category_name}</p>
        ) : null}
      </div>
    </Link>
  );
}
