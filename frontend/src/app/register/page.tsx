'use client';

import { RegisterPayload, useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password2: '',
    role: 'learner' as RegisterPayload['role'],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.password2) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        password2: form.password2,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
      });
      router.replace('/dashboard');
    } catch {
      setError('Could not create account. Check your details and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden surface-bg">
      <div className="gradient-orb absolute -left-48 top-20 h-96 w-96 bg-blue-400" />
      <div className="gradient-orb absolute -right-48 bottom-20 h-96 w-96 bg-purple-400" />
      <div className="relative mx-auto w-full max-w-lg flex-col px-4 py-12">
        <div className="rounded-3xl border border-white/20 bg-white/70 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
          <p className="text-center text-xl font-bold text-blue-600 dark:text-blue-400">Learnova</p>
          <h1 className="mt-4 text-center text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
          <p className="mt-1 text-center text-sm text-gray-600 dark:text-gray-400">Join as a learner or instructor</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First name
                </label>
                <input
                  id="first_name"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="glass-input mt-1 w-full"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last name
                </label>
                <input
                  id="last_name"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="glass-input mt-1 w-full"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="glass-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Role
              </label>
              <select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as RegisterPayload['role'],
                  }))
                }
                className="glass-input mt-1 w-full"
              >
                <option value="learner">Learner</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="glass-input mt-1 w-full"
              />
            </div>
            <div>
              <label htmlFor="password2" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm password
              </label>
              <input
                id="password2"
                type="password"
                required
                value={form.password2}
                onChange={(e) => setForm((f) => ({ ...f, password2: e.target.value }))}
                className="glass-input mt-1 w-full"
              />
            </div>
            {error && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
