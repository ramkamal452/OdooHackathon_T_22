'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Category,
  CourseDetail,
  LessonItem,
  ModuleItem,
  QuizListItem,
  api,
  mediaUrl,
  unwrapList,
} from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Tab = 'details' | 'modules' | 'quizzes';

interface OptionDraft {
  option_text: string;
  is_correct: boolean;
}

interface QuestionDraft {
  question_text: string;
  options: OptionDraft[];
}

export default function EditCoursePage() {
  const params = useParams();
  const courseId = String(params.id);

  const [tab, setTab] = useState<Tab>('details');
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('beginner');
  const [visibility, setVisibility] = useState('everyone');
  const [accessRule, setAccessRule] = useState('open');
  const [price, setPrice] = useState('');
  const [thumbFile, setThumbFile] = useState<File | null>(null);

  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    sort_order: 0,
  });
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null);

  const [lessonForm, setLessonForm] = useState({
    title: '',
    content_type: 'text' as LessonItem['content_type'],
    content_body: '',
    video_url: '',
    resource_url: '',
    duration_minutes: '',
    sort_order: 0,
    is_preview: false,
  });
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizPassPercentage, setQuizPassPercentage] = useState('70');
  const [quizModuleId, setQuizModuleId] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuestionDraft[]>([
    {
      question_text: '',
      options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
      ],
    },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: c } = await api.get<CourseDetail>(`/api/courses/${courseId}/`);
      setCourse(c);
      setTitle(c.title);
      setShortDescription(c.short_description || '');
      setDescription(c.description || '');
      setCategoryId(c.category?.id != null ? String(c.category.id) : '');
      setLevel(c.level || 'beginner');
      setVisibility(c.visibility || 'everyone');
      setAccessRule(c.access_rule || 'open');
      setPrice(c.price != null ? String(c.price) : '');

      const mods = [...(c.modules || [])].sort((a, b) => a.sort_order - b.sort_order);
      setSelectedModuleId((prev) => {
        if (prev && mods.some((m) => m.id === prev)) return prev;
        return mods[0]?.id ?? null;
      });

      try {
        const { data: qd } = await api.get<unknown>(`/api/quizzes/course/${courseId}/`);
        setQuizzes(unwrapList<QuizListItem>(qd));
      } catch {
        setQuizzes([]);
      }
    } catch {
      setError('Could not load course.');
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<unknown>('/api/categories/');
        setCategories(unwrapList<Category>(data));
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modulesSorted = useMemo(
    () => [...(course?.modules || [])].sort((a, b) => a.sort_order - b.sort_order),
    [course]
  );

  const selectedModule = useMemo(
    () => modulesSorted.find((m) => m.id === selectedModuleId) ?? null,
    [modulesSorted, selectedModuleId]
  );

  const lessonsSorted = useMemo(() => {
    if (!selectedModule?.lessons) return [];
    return [...selectedModule.lessons].sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedModule]);

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('short_description', shortDescription);
      fd.append('description', description);
      if (categoryId) fd.append('category', categoryId);
      fd.append('level', level);
      fd.append('visibility', visibility);
      fd.append('access_rule', accessRule);
      if (accessRule === 'payment' && price) {
        fd.append('price', price);
      }
      if (thumbFile) {
        fd.append('thumbnail', thumbFile);
      }
      const { data } = await api.put<CourseDetail>(`/api/courses/${courseId}/`, fd);
      setCourse(data);
      setThumbFile(null);
    } catch {
      setError('Could not save course details.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    setSaving(true);
    try {
      await api.post(`/api/courses/${courseId}/publish/`);
      await load();
    } catch {
      setError('Could not update publish state.');
    } finally {
      setSaving(false);
    }
  }

  function resetModuleForm() {
    setEditingModuleId(null);
    setModuleForm({
      title: '',
      description: '',
      sort_order: modulesSorted.length,
    });
  }

  async function submitModule(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: moduleForm.title,
        description: moduleForm.description,
        sort_order: Number(moduleForm.sort_order),
      };
      if (editingModuleId) {
        await api.put(`/api/modules/${editingModuleId}/`, payload);
      } else {
        await api.post(`/api/courses/${courseId}/modules/`, payload);
      }
      resetModuleForm();
      await load();
    } catch {
      setError('Could not save module.');
    } finally {
      setSaving(false);
    }
  }

  function startEditModule(m: ModuleItem) {
    setEditingModuleId(m.id);
    setModuleForm({
      title: m.title,
      description: m.description || '',
      sort_order: m.sort_order,
    });
    setSelectedModuleId(m.id);
  }

  async function deleteModule(id: number) {
    if (!confirm('Delete this module and its lessons?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/modules/${id}/`);
      if (selectedModuleId === id) setSelectedModuleId(null);
      if (editingModuleId === id) resetModuleForm();
      await load();
    } catch {
      setError('Could not delete module.');
    } finally {
      setSaving(false);
    }
  }

  function resetLessonForm() {
    setEditingLessonId(null);
    setLessonForm({
      title: '',
      content_type: 'text',
      content_body: '',
      video_url: '',
      resource_url: '',
      duration_minutes: '',
      sort_order: lessonsSorted.length,
      is_preview: false,
    });
  }

  async function submitLesson(e: FormEvent) {
    e.preventDefault();
    if (!selectedModuleId && !editingLessonId) {
      setError('Select or create a module first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: lessonForm.title,
        content_type: lessonForm.content_type,
        sort_order: Number(lessonForm.sort_order),
        is_preview: lessonForm.is_preview,
      };
      if (lessonForm.content_body) payload.content_body = lessonForm.content_body;
      if (lessonForm.video_url) payload.video_url = lessonForm.video_url;
      if (lessonForm.resource_url) payload.resource_url = lessonForm.resource_url;
      if (lessonForm.duration_minutes) {
        payload.duration_minutes = Number(lessonForm.duration_minutes);
      }

      if (editingLessonId) {
        await api.put(`/api/lessons/${editingLessonId}/`, payload);
      } else {
        await api.post(`/api/modules/${selectedModuleId}/lessons/`, payload);
      }
      resetLessonForm();
      await load();
    } catch {
      setError('Could not save lesson.');
    } finally {
      setSaving(false);
    }
  }

  function startEditLesson(l: LessonItem) {
    setEditingLessonId(l.id);
    setLessonForm({
      title: l.title,
      content_type: l.content_type,
      content_body: l.content_body || '',
      video_url: l.video_url || '',
      resource_url: l.resource_url || '',
      duration_minutes: l.duration_minutes != null ? String(l.duration_minutes) : '',
      sort_order: l.sort_order,
      is_preview: !!l.is_preview,
    });
  }

  async function deleteLesson(id: number) {
    if (!confirm('Delete this lesson?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/lessons/${id}/`);
      if (editingLessonId === id) resetLessonForm();
      await load();
    } catch {
      setError('Could not delete lesson.');
    } finally {
      setSaving(false);
    }
  }

  function addQuizQuestion() {
    setQuizQuestions((q) => [
      ...q,
      {
        question_text: '',
        options: [
          { option_text: '', is_correct: true },
          { option_text: '', is_correct: false },
        ],
      },
    ]);
  }

  function addOption(qi: number) {
    setQuizQuestions((prev) => {
      const copy = [...prev];
      copy[qi] = {
        ...copy[qi],
        options: [...copy[qi].options, { option_text: '', is_correct: false }],
      };
      return copy;
    });
  }

  async function submitQuiz(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: quizTitle,
        description: quizDescription,
        pass_percentage: Number(quizPassPercentage) || 0,
        questions: quizQuestions.map((q, i) => ({
          question_text: q.question_text,
          marks: 1,
          sort_order: i,
          options: q.options.map((o, j) => ({
            option_text: o.option_text,
            is_correct: o.is_correct,
            sort_order: j,
          })),
        })),
      };
      if (quizModuleId) {
        payload.module = Number(quizModuleId);
      }
      await api.post(`/api/quizzes/course/${courseId}/`, payload);
      setQuizTitle('');
      setQuizDescription('');
      setQuizPassPercentage('70');
      setQuizModuleId('');
      setQuizQuestions([
        {
          question_text: '',
          options: [
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false },
          ],
        },
      ]);
      await load();
    } catch {
      setError('Could not create quiz.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz(quizId: number) {
    if (!confirm('Delete this quiz?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/quizzes/${quizId}/`);
      await load();
    } catch {
      setError('Could not delete quiz.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ProtectedRoute roles={['instructor', 'admin']}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!course) {
    return (
      <ProtectedRoute roles={['instructor', 'admin']}>
        <p className="p-8 text-center text-rose-600">{error || 'Not found'}</p>
      </ProtectedRoute>
    );
  }

  const thumbPreview = thumbFile
    ? URL.createObjectURL(thumbFile)
    : mediaUrl(course.thumbnail);
  const isPublished = course.status === 'published';

  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/instructor"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              ← Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Edit course</h1>
            <p className="text-gray-600">{course.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={togglePublish}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-2 border-b border-gray-200">
          {(['details', 'modules', 'quizzes'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-4 py-2 text-sm font-medium capitalize ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        {tab === 'details' && (
          <form
            onSubmit={saveDetails}
            className="mt-6 space-y-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Short description</label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="everyone">Everyone</option>
                  <option value="signed_in">Signed in</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Access rule</label>
                <select
                  value={accessRule}
                  onChange={(e) => setAccessRule(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="invitation">Invitation</option>
                  <option value="payment">Payment</option>
                </select>
              </div>
            </div>
            {accessRule === 'payment' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
              {thumbPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbPreview} alt="" className="mt-2 h-32 w-auto rounded-lg object-cover" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
                className="mt-2 text-sm"
              />
            </div>
            <p className="text-sm text-gray-500">
              Status:{' '}
              <span className="font-medium capitalize text-gray-800">{course.status || 'draft'}</span>
            </p>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </form>
        )}

        {tab === 'modules' && (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[#1e40af]">
                  {editingModuleId ? 'Edit module' : 'Add module'}
                </h2>
                <form onSubmit={submitModule} className="mt-4 space-y-4">
                  <input
                    placeholder="Title"
                    required
                    value={moduleForm.title}
                    onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="Description"
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <input
                    type="number"
                    placeholder="Sort order"
                    value={moduleForm.sort_order}
                    onChange={(e) =>
                      setModuleForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {editingModuleId ? 'Update module' : 'Add module'}
                    </button>
                    {editingModuleId && (
                      <button
                        type="button"
                        onClick={resetModuleForm}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Modules</h2>
                <ul className="mt-4 divide-y divide-gray-100">
                  {modulesSorted.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModuleId(m.id);
                          resetLessonForm();
                        }}
                        className={`text-left font-medium ${
                          selectedModuleId === m.id ? 'text-blue-600' : 'text-gray-900'
                        }`}
                      >
                        {m.title}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({m.lessons?.length ?? m.lesson_count ?? 0} lessons)
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditModule(m)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteModule(m.id)}
                          className="text-sm text-rose-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {modulesSorted.length === 0 && (
                  <p className="mt-4 text-sm text-gray-500">No modules yet. Add one to add lessons.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedModule ? `Lessons — ${selectedModule.title}` : 'Lessons'}
              </h2>
              {!selectedModule ? (
                <p className="mt-4 text-sm text-gray-500">Select a module to manage lessons.</p>
              ) : (
                <>
                  <form onSubmit={submitLesson} className="mt-4 space-y-4 border-b border-gray-100 pb-6">
                    <p className="text-sm font-medium text-blue-800">
                      {editingLessonId ? 'Edit lesson' : 'Add lesson'}
                    </p>
                    <input
                      placeholder="Title"
                      required
                      value={lessonForm.title}
                      onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={lessonForm.content_type}
                      onChange={(e) =>
                        setLessonForm((f) => ({
                          ...f,
                          content_type: e.target.value as LessonItem['content_type'],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="link">Link</option>
                    </select>
                    {lessonForm.content_type === 'video' && (
                      <input
                        placeholder="Video URL (embed)"
                        value={lessonForm.video_url}
                        onChange={(e) => setLessonForm((f) => ({ ...f, video_url: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    )}
                    {lessonForm.content_type === 'text' && (
                      <textarea
                        placeholder="Content"
                        value={lessonForm.content_body}
                        onChange={(e) => setLessonForm((f) => ({ ...f, content_body: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        rows={4}
                      />
                    )}
                    {(lessonForm.content_type === 'pdf' || lessonForm.content_type === 'link') && (
                      <input
                        placeholder="Resource URL"
                        value={lessonForm.resource_url}
                        onChange={(e) => setLessonForm((f) => ({ ...f, resource_url: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    )}
                    {lessonForm.content_type === 'link' && (
                      <textarea
                        placeholder="Notes (optional)"
                        value={lessonForm.content_body}
                        onChange={(e) => setLessonForm((f) => ({ ...f, content_body: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        rows={2}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Duration (min)"
                        value={lessonForm.duration_minutes}
                        onChange={(e) =>
                          setLessonForm((f) => ({ ...f, duration_minutes: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Sort order"
                        value={lessonForm.sort_order}
                        onChange={(e) =>
                          setLessonForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={lessonForm.is_preview}
                        onChange={(e) =>
                          setLessonForm((f) => ({ ...f, is_preview: e.target.checked }))
                        }
                      />
                      Preview (free)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {editingLessonId ? 'Update' : 'Add'} lesson
                      </button>
                      {editingLessonId && (
                        <button
                          type="button"
                          onClick={resetLessonForm}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                  <ul className="mt-4 divide-y divide-gray-100">
                    {lessonsSorted.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{l.title}</p>
                          <p className="text-xs text-gray-500">{l.content_type}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditLesson(l)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLesson(l.id)}
                            className="text-sm text-rose-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {lessonsSorted.length === 0 && (
                    <p className="mt-4 text-sm text-gray-500">No lessons in this module yet.</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'quizzes' && (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <form
              onSubmit={submitQuiz}
              className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-900">New quiz</h2>
              <input
                placeholder="Quiz title"
                required
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">Pass %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={quizPassPercentage}
                    onChange={(e) => setQuizPassPercentage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Module (optional)</label>
                  <select
                    value={quizModuleId}
                    onChange={(e) => setQuizModuleId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Course-wide</option>
                    {modulesSorted.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {quizQuestions.map((q, qi) => (
                <div key={qi} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-medium text-gray-700">Question {qi + 1}</p>
                  <textarea
                    placeholder="Question text"
                    required
                    value={q.question_text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuizQuestions((prev) => {
                        const copy = [...prev];
                        copy[qi] = { ...copy[qi], question_text: v };
                        return copy;
                      });
                    }}
                    className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    rows={2}
                  />
                  <div className="mt-2 space-y-2">
                    {q.options.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={c.is_correct}
                          onChange={() => {
                            setQuizQuestions((prev) => {
                              const copy = [...prev];
                              copy[qi] = {
                                ...copy[qi],
                                options: copy[qi].options.map((ch, idx) => ({
                                  ...ch,
                                  is_correct: idx === ci,
                                })),
                              };
                              return copy;
                            });
                          }}
                          className="text-blue-600"
                        />
                        <input
                          placeholder={`Option ${ci + 1}`}
                          value={c.option_text}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQuizQuestions((prev) => {
                              const copy = [...prev];
                              const options = [...copy[qi].options];
                              options[ci] = { ...options[ci], option_text: v };
                              copy[qi] = { ...copy[qi], options };
                              return copy;
                            });
                          }}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addOption(qi)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    + Add option
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addQuizQuestion}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                + Add question
              </button>
              <button
                type="submit"
                disabled={saving}
                className="block w-full rounded-lg bg-[#2563eb] py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create quiz
              </button>
            </form>

            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Existing quizzes</h2>
              <ul className="mt-4 space-y-3">
                {quizzes.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <span className="font-medium text-gray-900">{q.title}</span>
                    <button
                      type="button"
                      onClick={() => deleteQuiz(q.id)}
                      className="text-sm text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              {quizzes.length === 0 && (
                <p className="mt-4 text-sm text-gray-500">No quizzes yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
