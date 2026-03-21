'use client';

import { type LessonItem, type ModuleItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Link as LinkIcon,
  Play,
  File,
  Image,
  Music,
} from 'lucide-react';
import { useState } from 'react';

interface LessonListProps {
  modules: ModuleItem[];
  currentLessonId?: number;
  onSelect: (lesson: LessonItem) => void;
  completedMap?: Map<number, boolean>;
  searchQuery?: string;
}

const contentIcons: Record<string, React.ElementType> = {
  video: Play,
  text: FileText,
  pdf: File,
  link: LinkIcon,
  document: File,
  image: Image,
  audio: Music,
};

export default function LessonList({
  modules,
  currentLessonId,
  onSelect,
  completedMap = new Map(),
  searchQuery = '',
}: LessonListProps) {
  const query = searchQuery.toLowerCase().trim();
  const sortedMods = [...modules].sort((a, b) => a.sort_order - b.sort_order);
  const [expanded, setExpanded] = useState<Set<number>>(
    new Set(sortedMods.map((m) => m.id))
  );

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {sortedMods.map((mod) => {
        const allLessons = [...(mod.lessons || [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );
        const lessons = query
          ? allLessons.filter((l) => l.title.toLowerCase().includes(query))
          : allLessons;
        if (query && lessons.length === 0) return null;
        const isOpen = expanded.has(mod.id);

        return (
          <div key={mod.id} className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => toggle(mod.id)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{mod.title}</p>
                <p className="text-xs text-muted-foreground">
                  {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            {isOpen && lessons.length > 0 && (
              <div className="border-t px-2 py-1.5">
                {lessons.map((lesson) => {
                  const Icon = contentIcons[lesson.content_type] || FileText;
                  const completed = completedMap.get(lesson.id);
                  const isCurrent = lesson.id === currentLessonId;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => onSelect(lesson)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isCurrent
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted/50 text-foreground'
                      )}
                    >
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate">{lesson.title}</span>
                      {lesson.duration_minutes != null && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {lesson.duration_minutes}m
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
