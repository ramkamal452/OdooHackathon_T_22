'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import { Category, api, unwrapList } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function NewCoursePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('beginner');
  const [visibility, setVisibility] = useState('everyone');
  const [accessRule, setAccessRule] = useState('open');
  const [price, setPrice] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('short_description', shortDescription);
      fd.append('description', description);
      if (categoryId) {
        fd.append('category', categoryId);
      }
      fd.append('level', level);
      fd.append('visibility', visibility);
      fd.append('access_rule', accessRule);
      if (accessRule === 'payment' && price) {
        fd.append('price', price);
      }
      if (thumbnail) {
        fd.append('thumbnail', thumbnail);
      }
      const { data } = await api.post<{ id: number }>('/api/courses/', fd);
      router.replace(`/dashboard/instructor/courses/${data.id}/edit`);
    } catch {
      setError('Could not create course. Check required fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <ProtectedRoute roles={['instructor', 'admin']}>
      <div className="min-h-screen surface-bg">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create course</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Add details — you can add modules and lessons next.</p>

          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 rounded-2xl p-8"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="glass-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="short_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Short description
              </label>
              <textarea
                id="short_description"
                rows={2}
                required
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="glass-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Full description
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="glass-input mt-1 w-full"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <select
                  id="category"
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
                <label htmlFor="level" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Level
                </label>
                <select
                  id="level"
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
            <div>
              <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Thumbnail
              </label>
              <input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 dark:text-gray-400 dark:file:bg-blue-400/10 dark:file:text-blue-300"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Visibility
                </label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="glass-input mt-1 w-full"
                >
                  <option value="everyone">Everyone</option>
                  <option value="signed_in">Signed in</option>
                </select>
              </div>
              <div>
                <label htmlFor="access_rule" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Access rule
                </label>
                <select
                  id="access_rule"
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
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Price
                </label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="glass-input mt-1 w-full"
                />
              </div>
            )}
            {error && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? 'Saving…' : 'Save course'}
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
