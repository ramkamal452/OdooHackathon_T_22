'use client';

import { LessonItem, ModuleItem } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

interface LessonListProps {
  modules: ModuleItem[];
  currentLessonId?: number;
  onSelect: (lesson: LessonItem) => void;
  completedMap: Map<number, boolean>;
}

export default function LessonList({
  modules,
  currentLessonId,
  onSelect,
  completedMap,
}: LessonListProps) {
  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => a.sort_order - b.sort_order),
    [modules]
  );

  const [openIds, setOpenIds] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (sortedModules[0]) s.add(sortedModules[0].id);
    return s;
  });

  useEffect(() => {
    setOpenIds((prev) => {
      if (prev.size > 0 || !sortedModules[0]) return prev;
      return new Set(prev).add(sortedModules[0].id);
    });
  }, [sortedModules]);

  useEffect(() => {
    if (!currentLessonId) return;
    sortedModules.forEach((m) => {
      if (m.lessons?.some((l) => l.id === currentLessonId)) {
        setOpenIds((prev) => new Set(prev).add(m.id));
      }
    });
  }, [currentLessonId, sortedModules]);

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {sortedModules.map((mod) => {
        const lessons = [...(mod.lessons || [])].sort((a, b) => a.sort_order - b.sort_order);
        const isOpen = openIds.has(mod.id);
        return (
          <div key={mod.id} className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50/80">
            <button
              type="button"
              onClick={() => toggle(mod.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-blue-50/60"
            >
              <div>
                <p className="text-sm font-semibold text-blue-900">{mod.title}</p>
                <p className="text-xs text-gray-500">
                  {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
                </p>
              </div>
              <span className="text-gray-400">
                <svg
                  className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <ul className="space-y-1 border-t border-gray-100 bg-white px-2 py-2">
                {lessons.map((lesson, idx) => {
                  const done = completedMap.get(lesson.id) ?? lesson.is_completed;
                  const active = lesson.id === currentLessonId;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lesson)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                          active
                            ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                          {idx + 1}
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">{lesson.title}</span>
                        </span>
                        {done ? (
                          <span className="text-emerald-500" title="Completed">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-gray-300">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" strokeWidth="2" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
