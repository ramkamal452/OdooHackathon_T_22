'use client';

import ContentManager from '@/components/ContentManager';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Category, CourseDetail, api, mediaUrl, unwrapList } from '@/lib/api';
import { Layers, Save, Send, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function EditCoursePage() {
  const params = useParams();
  const courseId = String(params.id);

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
    } finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<unknown>('/api/categories/');
        setCategories(unwrapList<Category>(data));
      } catch { setCategories([]); }
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
    } catch { setError('Could not save course details.'); }
    finally { setSaving(false); }
  }

  async function togglePublish() {
    setSaving(true);
    try { await api.post(`/api/courses/${courseId}/publish/`); await load(); }
    catch { setError('Could not update publish state.'); }
    finally { setSaving(false); }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setSaving(true);
    setInviteMsg('');
    try {
      await api.post(`/api/courses/${courseId}/invite/`, { email: inviteEmail.trim() });
      setInviteMsg('Invitation sent!');
      setInviteEmail('');
    } catch { setInviteMsg('Could not send invitation.'); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 text-center"><p className="text-destructive">{error || 'Not found'}</p></div>
    );
  }

  const thumbPreview = thumbFile ? URL.createObjectURL(thumbFile) : mediaUrl(course.thumbnail);
  const isPublished = course.status === 'published';

  return (
    <>
      <DashboardHeader
        title="Edit Course"
        subtitle={course.title}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isPublished ? 'default' : 'secondary'}>{isPublished ? 'Published' : 'Draft'}</Badge>
            <Button variant="outline" size="sm" onClick={togglePublish} disabled={saving}>
              {isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/instructor/content"><Layers className="mr-1.5 h-4 w-4" />Content Manager</Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-8 lg:px-8">
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details"><Settings className="mr-1.5 h-4 w-4" />Details</TabsTrigger>
            <TabsTrigger value="content"><Layers className="mr-1.5 h-4 w-4" />Content</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={saveDetails} className="space-y-6">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Short description</Label>
                    <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Level</Label>
                      <Select value={level} onValueChange={(v) => setLevel(v ?? 'beginner')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <Select value={visibility} onValueChange={(v) => setVisibility(v ?? 'public')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">Everyone</SelectItem>
                          <SelectItem value="signed_in">Signed in</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Access rule</Label>
                      <Select value={accessRule} onValueChange={(v) => setAccessRule(v ?? 'open')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="invitation">Invitation</SelectItem>
                          <SelectItem value="payment">Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {accessRule === 'payment' && (
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Thumbnail</Label>
                    {thumbPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbPreview} alt="" className="h-32 w-auto rounded-lg object-cover" />
                    )}
                    <Input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save details'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invite Attendee</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input type="email" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                  <Button onClick={sendInvite} disabled={saving}>
                    <Send className="mr-2 h-4 w-4" />Send invite
                  </Button>
                </div>
                {inviteMsg && (
                  <p className={`mt-2 text-sm ${inviteMsg.includes('sent') ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {inviteMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
              <p className="text-sm text-primary">
                Add <strong>modules</strong>, <strong>lessons</strong>, <strong>quizzes</strong>, <strong>videos</strong>, and <strong>resources</strong> in any hierarchy.
              </p>
            </Card>
            <ContentManager rootId={courseEntityId} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
