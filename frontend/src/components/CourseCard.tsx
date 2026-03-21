import { CourseListItem, mediaUrl } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import ProgressBar from './ProgressBar';

interface CourseCardProps {
  course: CourseListItem;
  href: string;
  progress?: number;
}

export default function CourseCard({ course, href, progress }: CourseCardProps) {
  const thumb = mediaUrl(course.thumbnail);
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
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:border-blue-100 hover:shadow-md"
    >
      <div className="relative aspect-video w-full bg-gray-100">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-blue-200">
            <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v4H8v-4z" />
            </svg>
          </div>
        )}
        {progress !== undefined && progress >= 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 backdrop-blur-sm">
            <ProgressBar value={progress} showLabel />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 flex-1 text-lg font-semibold text-gray-900 group-hover:text-[#2563eb]">
            {course.title}
          </h3>
          {course.level ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
              {course.level}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-600">{desc}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{instructor}</span>
          <span>{lessons} lessons</span>
        </div>
        {course.category_name ? (
          <p className="mt-2 text-xs font-medium text-[#2563eb]">{course.category_name}</p>
        ) : null}
      </div>
    </Link>
  );
}
