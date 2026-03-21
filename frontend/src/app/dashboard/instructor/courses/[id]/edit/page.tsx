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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
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
        is_published: true,
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
  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    setInviteMsg('');
    try {
      await api.post(`/api/courses/${courseId}/invite/`, { email: inviteEmail.trim() });
      setInviteMsg('Invitation sent!');
      setInviteEmail('');
    } catch {
      setInviteMsg('Could not send invitation.');
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
        <div className="flex min-h-[40vh] items-center justify-center surface-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent" />
        </div>
      </ProtectedRoute>
    );
  }
  if (!course) {
    return (
      <ProtectedRoute roles={['instructor', 'admin']}>
        <p className="p-8 text-center text-rose-500 dark:text-rose-400">{error || 'Not found'}</p>
      </ProtectedRoute>
    );
  }
  const thumbPreview = thumbFile
    ? URL.createObjectURL(thumbFile)
    : mediaUrl(course.thumbnail);
  const isPublished = course.status === 'published';
  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="min-h-screen surface-bg">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/dashboard/instructor"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Dashboard
              </Link>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                Edit course
              </h1>
              <p className="text-gray-600 dark:text-gray-400">{course.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={togglePublish} disabled={saving} className="btn-secondary">
                {isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {(['details', 'modules', 'quizzes'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400'
                    : 'border-transparent bg-white/50 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">{error}</p>}
          {tab === 'details' && (
  <>
    <form onSubmit={saveDetails} className="glass-card mt-6 space-y-6 rounded-2xl p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="glass-input mt-1 w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Short description
        </label>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="glass-input mt-1 w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Full description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="glass-input mt-1 w-full"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="glass-input mt-1 w-full"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="glass-input mt-1 w-full"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Visibility
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="glass-input mt-1 w-full"
          >
            <option value="everyone">Everyone</option>
            <option value="signed_in">Signed in</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Access rule
          </label>
          <select
            value={accessRule}
            onChange={(e) => setAccessRule(e.target.value)}
            className="glass-input mt-1 w-full"
          >
            <option value="open">Open</option>
            <option value="invitation">Invitation</option>
            <option value="payment">Payment</option>
          </select>
        </div>
      </div>
      {accessRule === 'payment' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="glass-input mt-1 w-full"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Thumbnail</label>
        {thumbPreview && (
          <img
            src={thumbPreview}
            alt=""
            className="mt-2 h-32 w-auto rounded-xl object-cover"
          />
        )}
        <div className="glass-card mt-2 rounded-xl p-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 dark:text-gray-400 dark:file:bg-blue-400/10 dark:file:text-blue-300"
          />
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Status:{' '}
        {course.status === 'published' ? (
          <span className="ml-1 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium capitalize text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
            Published
          </span>
        ) : (
          <span className="ml-1 inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2 py-0.5 font-medium capitalize text-gray-600 dark:bg-gray-400/10 dark:text-gray-400">
            {course.status || 'draft'}
          </span>
        )}
      </p>
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </form>

    <div className="glass-card mt-6 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite attendee</h2>
      <div className="mt-4 flex gap-2">
        <input
          type="email"
          placeholder="Email address"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="glass-input flex-1"
        />
        <button type="button" onClick={sendInvite} disabled={saving} className="btn-primary">
          Send invite
        </button>
      </div>
      {inviteMsg && (
        <p
          className={`mt-2 text-sm ${
            inviteMsg.includes('sent')
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400'
          }`}
        >
          {inviteMsg}
        </p>
      )}
    </div>
  </>
)}
          {tab === 'modules' && (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingModuleId ? 'Edit module' : 'Add module'}
                  </h2>
                  <form onSubmit={submitModule} className="mt-4 space-y-4">
                    <input
                      placeholder="Title"
                      required
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                      className="glass-input w-full"
                    />
                    <textarea
                      placeholder="Description"
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                      className="glass-input w-full"
                      rows={2}
                    />
                    <input
                      type="number"
                      placeholder="Sort order"
                      value={moduleForm.sort_order}
                      onChange={(e) =>
                        setModuleForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                      }
                      className="glass-input w-full"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={saving} className="btn-primary">
                        {editingModuleId ? 'Update module' : 'Add module'}
                      </button>
                      {editingModuleId && (
                        <button type="button" onClick={resetModuleForm} className="btn-secondary">
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Modules</h2>
                  <ul className="mt-4 divide-y divide-white/10 dark:divide-white/5">
                    {modulesSorted.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors hover:bg-white/30 dark:hover:bg-white/5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModuleId(m.id);
                            resetLessonForm();
                          }}
                          className={`text-left font-medium ${
                            selectedModuleId === m.id
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {m.title}
                          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-500">
                            ({m.lessons?.length ?? m.lesson_count ?? 0} lessons)
                          </span>
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditModule(m)}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteModule(m.id)}
                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {modulesSorted.length === 0 && (
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                      No modules yet. Add one to add lessons.
                    </p>
                  )}
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedModule ? `Lessons — ${selectedModule.title}` : 'Lessons'}
                </h2>
                {!selectedModule ? (
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    Select a module to manage lessons.
                  </p>
                ) : (
                  <>
                    <form
                      onSubmit={submitLesson}
                      className="mt-4 space-y-4 border-b border-white/10 pb-6 dark:border-white/5"
                    >
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {editingLessonId ? 'Edit lesson' : 'Add lesson'}
                      </p>
                      <input
                        placeholder="Title"
                        required
                        value={lessonForm.title}
                        onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                        className="glass-input w-full"
                      />
                      <select
                        value={lessonForm.content_type}
                        onChange={(e) =>
                          setLessonForm((f) => ({
                            ...f,
                            content_type: e.target.value as LessonItem['content_type'],
                          }))
                        }
                        className="glass-input w-full"
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
                          className="glass-input w-full"
                        />
                      )}
                      {lessonForm.content_type === 'text' && (
                        <textarea
                          placeholder="Content"
                          value={lessonForm.content_body}
                          onChange={(e) => setLessonForm((f) => ({ ...f, content_body: e.target.value }))}
                          className="glass-input w-full"
                          rows={4}
                        />
                      )}
                      {(lessonForm.content_type === 'pdf' || lessonForm.content_type === 'link') && (
                        <input
                          placeholder="Resource URL"
                          value={lessonForm.resource_url}
                          onChange={(e) => setLessonForm((f) => ({ ...f, resource_url: e.target.value }))}
                          className="glass-input w-full"
                        />
                      )}
                      {lessonForm.content_type === 'link' && (
                        <textarea
                          placeholder="Notes (optional)"
                          value={lessonForm.content_body}
                          onChange={(e) => setLessonForm((f) => ({ ...f, content_body: e.target.value }))}
                          className="glass-input w-full"
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
                          className="glass-input w-full"
                        />
                        <input
                          type="number"
                          placeholder="Sort order"
                          value={lessonForm.sort_order}
                          onChange={(e) =>
                            setLessonForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                          }
                          className="glass-input w-full"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={lessonForm.is_preview}
                          onChange={(e) =>
                            setLessonForm((f) => ({ ...f, is_preview: e.target.checked }))
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 dark:border-white/20 dark:bg-white/5"
                        />
                        Preview (free)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={saving} className="btn-primary">
                          {editingLessonId ? 'Update' : 'Add'} lesson
                        </button>
                        {editingLessonId && (
                          <button type="button" onClick={resetLessonForm} className="btn-secondary">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <ul className="mt-4 divide-y divide-white/10 dark:divide-white/5">
                      {lessonsSorted.map((l) => (
                        <li
                          key={l.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors hover:bg-white/30 dark:hover:bg-white/5"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{l.title}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{l.content_type}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditLesson(l)}
                              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLesson(l.id)}
                              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {lessonsSorted.length === 0 && (
                      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                        No lessons in this module yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {tab === 'quizzes' && (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <form onSubmit={submitQuiz} className="glass-card space-y-4 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New quiz</h2>
                <input
                  placeholder="Quiz title"
                  required
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="glass-input w-full"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  className="glass-input w-full"
                  rows={2}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Pass %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={quizPassPercentage}
                      onChange={(e) => setQuizPassPercentage(e.target.value)}
                      className="glass-input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Module (optional)
                    </label>
                    <select
                      value={quizModuleId}
                      onChange={(e) => setQuizModuleId(e.target.value)}
                      className="glass-input mt-1 w-full"
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
                  <div key={qi} className="glass-card rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Question {qi + 1}
                    </p>
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
                      className="glass-input mt-2 w-full"
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
                            className="text-blue-600 dark:text-blue-400"
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
                            className="glass-input flex-1"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addOption(qi)}
                      className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      + Add option
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addQuizQuestion}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  + Add question
                </button>
                <button type="submit" disabled={saving} className="btn-primary block w-full">
                  Create quiz
                </button>
              </form>
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Existing quizzes</h2>
                <ul className="mt-4 space-y-3">
                  {quizzes.map((q) => (
                    <li
                      key={q.id}
                      className="glass-card flex items-center justify-between rounded-xl px-4 py-3"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{q.title}</span>
                      <button
                        type="button"
                        onClick={() => deleteQuiz(q.id)}
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
                {quizzes.length === 0 && (
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">No quizzes yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
