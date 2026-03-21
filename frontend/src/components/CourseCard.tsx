'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { type CourseListItem, mediaUrl } from '@/lib/api';
import { BookOpen, Clock, Users } from 'lucide-react';
import Link from 'next/link';

interface CourseCardProps {
  course: CourseListItem;
  href: string;
  progress?: number;
}

export default function CourseCard({ course, href, progress }: CourseCardProps) {
  const thumb = mediaUrl(course.thumbnail);

  return (
    <Link href={href} className="group block">
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <div className="relative aspect-video overflow-hidden bg-muted">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          {course.level && (
            <Badge variant="secondary" className="absolute right-3 top-3 capitalize">
              {course.level}
            </Badge>
          )}
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {(course.category_name || course.category?.name) && (
              <Badge variant="outline" className="text-xs font-normal">
                {course.category_name || course.category?.name}
              </Badge>
            )}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary transition-colors">
            {course.title}
          </h3>
        </CardHeader>
        <CardContent className="pb-2">
          {course.short_description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {course.short_description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {course.instructor_name && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {course.instructor_name}
              </span>
            )}
            {course.lesson_count != null && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {course.lesson_count} lessons
              </span>
            )}
            {course.duration_minutes != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.duration_minutes}m
              </span>
            )}
          </div>
        </CardContent>
        {progress != null && (
          <CardFooter className="pt-0">
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
