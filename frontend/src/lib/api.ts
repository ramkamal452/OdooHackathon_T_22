import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8000';

export const ACCESS_KEY = 'learnova_access_token';
export const REFRESH_KEY = 'learnova_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const base = API_BASE.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export const api = axios.create({
  baseURL: API_BASE,
});

let isRefreshing = false;
let queue: Array<{
  resolve: (t: string) => void;
  reject: (e: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  queue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  queue = [];
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  } else if (config.headers['Content-Type'] === undefined) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (!original) return Promise.reject(error);
    const status = error.response?.status;
    const url = original.url || '';

    if (status !== 401) {
      return Promise.reject(error);
    }
    if (url.includes('/api/auth/token/refresh/')) {
      clearStoredTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }
    if (original._retry) {
      clearStoredTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) {
      clearStoredTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post<{ access: string }>(
        `${API_BASE}/api/auth/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } }
      );
      localStorage.setItem(ACCESS_KEY, data.access);
      flushQueue(null, data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (e) {
      flushQueue(e, null);
      clearStoredTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export type UserRole = 'learner' | 'instructor' | 'admin';

export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === 'object' &&
    'results' in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  bio?: string;
  avatar?: string | null;
  is_staff?: boolean;
  date_joined?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
}

export interface ModuleItem {
  id: number;
  title: string;
  description?: string;
  sort_order: number;
  lessons?: LessonItem[];
  lesson_count?: number;
}

export interface LessonItem {
  id: number;
  title: string;
  content_type: 'video' | 'text' | 'pdf' | 'link';
  content_body?: string;
  video_url?: string;
  resource_url?: string;
  duration_minutes?: number | null;
  sort_order: number;
  is_preview?: boolean;
  is_completed?: boolean;
}

export interface CourseListItem {
  id: number;
  title: string;
  slug?: string;
  short_description?: string;
  description?: string;
  thumbnail?: string | null;
  instructor_name?: string;
  instructor?: { id: number; first_name: string; last_name: string; email: string };
  category_name?: string;
  category?: Category | null;
  level?: string;
  status?: string;
  lesson_count?: number;
  enrollment_count?: number;
  duration_minutes?: number | null;
  created_at?: string;
}

export interface CourseDetail extends CourseListItem {
  modules: ModuleItem[];
  visibility?: string;
  access_rule?: string;
  price?: string | null;
  enrollment_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface QuizListItem {
  id: number;
  title: string;
  description?: string;
  question_count?: number;
  course_id?: number;
  module_id?: number | null;
  pass_percentage?: number;
  is_published?: boolean;
}

export interface QuizOption {
  id: number;
  option_text: string;
  is_correct?: boolean;
  sort_order?: number;
}

export interface QuizQuestion {
  id: number;
  question_text: string;
  question_type?: string;
  marks?: number;
  sort_order: number;
  options: QuizOption[];
}

export interface QuizDetail {
  id: number;
  title: string;
  description?: string;
  pass_percentage?: number;
  is_published?: boolean;
  questions: QuizQuestion[];
}

export interface QuizAttemptResult {
  score: number;
  total_marks: number;
  percentage: number;
  is_passed: boolean;
  submitted_at?: string;
  answers?: Array<{
    question_id: number;
    selected_option_id: number;
    is_correct: boolean;
    marks_awarded: number;
  }>;
}
