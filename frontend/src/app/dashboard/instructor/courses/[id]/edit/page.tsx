'use client';
import ContentManager from '@/components/ContentManager';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Category, CourseDetail, api, mediaUrl, unwrapList } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Tab = 'details' | 'content';

export default function EditCoursePage() {
  const params = useParams();
  const courseId = String(params.id);

  const [tab, setTab] = useState<Tab>('details');
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

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

  useEffect(() => { load(); }, [load]);

  const courseEntityId = useMemo(() => {
    if (!course) return undefined;
    return (course as unknown as { entity_id?: number }).entity_id || Number(courseId);
  }, [course, courseId]);

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
      if (accessRule === 'payment' && price) fd.append('price', price);
      if (thumbFile) fd.append('thumbnail', thumbFile);
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

  const thumbPreview = thumbFile ? URL.createObjectURL(thumbFile) : mediaUrl(course.thumbnail);
  const isPublished = course.status === 'published';

  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="min-h-screen surface-bg">
        <div className="mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6">
          {/* Header */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/dashboard/instructor" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                &larr; Dashboard
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Edit course</h1>
              <p className="text-gray-600 dark:text-gray-400">{course.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/instructor/content" className="btn-secondary text-sm">
                Content Manager
              </Link>
              <button type="button" onClick={togglePublish} disabled={saving} className="btn-secondary">
                {isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-2">
            {(['details', 'content'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-xl border px-5 py-2.5 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400'
                    : 'border-transparent bg-white/50 text-gray-600 dark:bg-white/10 dark:text-gray-400'
                }`}
              >
                {t === 'content' ? '📦 Content' : '⚙ Details'}
              </button>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">{error}</p>}

          {/* ─── DETAILS TAB ─── */}
          {tab === 'details' && (
            <>
              <form onSubmit={saveDetails} className="glass-card mt-6 space-y-6 rounded-2xl p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="glass-input mt-1 w-full" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Short description</label>
                  <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className="glass-input mt-1 w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="glass-input mt-1 w-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="glass-input mt-1 w-full">
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass-input mt-1 w-full">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label>
                    <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="glass-input mt-1 w-full">
                      <option value="everyone">Everyone</option>
                      <option value="signed_in">Signed in</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Access rule</label>
                    <select value={accessRule} onChange={(e) => setAccessRule(e.target.value)} className="glass-input mt-1 w-full">
                      <option value="open">Open</option>
                      <option value="invitation">Invitation</option>
                      <option value="payment">Payment</option>
                    </select>
                  </div>
                </div>
                {accessRule === 'payment' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                    <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="glass-input mt-1 w-full" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Thumbnail</label>
                  {thumbPreview && <img src={thumbPreview} alt="" className="mt-2 h-32 w-auto rounded-xl object-cover" />}
                  <div className="glass-card mt-2 rounded-xl p-4">
                    <input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 dark:text-gray-400 dark:file:bg-blue-400/10 dark:file:text-blue-300" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status:{' '}
                  {course.status === 'published' ? (
                    <span className="ml-1 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium capitalize text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">Published</span>
                  ) : (
                    <span className="ml-1 inline-flex rounded-full border border-gray-500/20 bg-gray-500/10 px-2 py-0.5 font-medium capitalize text-gray-600 dark:bg-gray-400/10 dark:text-gray-400">{course.status || 'draft'}</span>
                  )}
                </p>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save details'}</button>
              </form>

              <div className="glass-card mt-6 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite attendee</h2>
                <div className="mt-4 flex gap-2">
                  <input type="email" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="glass-input flex-1" />
                  <button type="button" onClick={sendInvite} disabled={saving} className="btn-primary">Send invite</button>
                </div>
                {inviteMsg && (
                  <p className={`mt-2 text-sm ${inviteMsg.includes('sent') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {inviteMsg}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ─── CONTENT TAB (unified tree) ─── */}
          {tab === 'content' && (
            <div className="mt-6">
              <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Add <strong>modules</strong>, <strong>lessons</strong>, <strong>quizzes</strong>, <strong>videos</strong>, and <strong>resources</strong> in any hierarchy.
                  Click the <span className="font-mono text-blue-600">+</span> button on any container to nest content inside it.
                </p>
              </div>
              <ContentManager rootId={courseEntityId} />
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
