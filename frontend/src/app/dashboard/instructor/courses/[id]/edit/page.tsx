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
import { useToast } from '@/components/Toast';
import { Category, CourseDetail, api, mediaUrl, unwrapList } from '@/lib/api';
import { HelpCircle, Layers, Save, Send, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function EditCoursePage() {
  const params = useParams();
  const courseId = String(params.id);
  const { toast } = useToast();

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
  const [tags, setTags] = useState('');
  const [website, setWebsite] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [users, setUsers] = useState<{ id: number; first_name: string; last_name: string; email: string }[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: c } = await api.get<CourseDetail>(`/api/courses/${courseId}/`);
      setCourse(c);
      setTitle(c.title);
      setTags(c.tags || '');
      setWebsite(c.website || '');
      setResponsibleId(c.responsible?.id != null ? String(c.responsible.id) : '');
      setShortDescription(c.short_description || '');
      setDescription(c.description || '');
      setCategoryId(c.category?.id != null ? String(c.category.id) : '');
      setLevel(c.level || 'beginner');
      setVisibility(c.visibility || 'everyone');
      setAccessRule(c.access_rule || 'open');
      setPrice(c.price != null ? String(c.price) : '');
      try {
        const { data: qd } = await api.get(`/api/quizzes/course/${courseId}/`);
        const list = Array.isArray(qd) ? qd : (qd as any).results || [];
        setQuizzes(list);
      } catch { setQuizzes([]); }
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
      try {
        const { data: u } = await api.get<unknown>('/api/users/');
        const list = Array.isArray(u) ? u : (u as any).results || [];
        setUsers(list);
      } catch { setUsers([]); }
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
      fd.append('tags', tags);
      fd.append('website', website);
      if (responsibleId) fd.append('responsible', responsibleId);
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
            <Button variant="outline" size="sm" onClick={() => window.open(`/courses/${courseId}`, '_blank')}>
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/courses/${courseId}`); }}>
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast('Contact attendees feature coming soon.', 'info')}>
              Contact
            </Button>
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
            <TabsTrigger value="quizzes"><HelpCircle className="mr-1.5 h-4 w-4" />Quizzes</TabsTrigger>
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
                    <Label>Tags</Label>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated tags, e.g. python, web, beginner" />
                  </div>
                  <div className="space-y-2">
                    <Label>Short description</Label>
                    <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} />
                  </div>
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Full description</CardTitle>
                      <p className="text-sm font-normal text-muted-foreground">
                        Detailed overview shown on the course page. Supports markdown formatting.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
                        {[
                          { label: 'B', prefix: '**', suffix: '**', title: 'Bold' },
                          { label: 'I', prefix: '_', suffix: '_', title: 'Italic' },
                          { label: 'H1', prefix: '# ', suffix: '', title: 'Heading 1' },
                          { label: 'H2', prefix: '## ', suffix: '', title: 'Heading 2' },
                          { label: '•', prefix: '- ', suffix: '', title: 'Bullet list' },
                          { label: '1.', prefix: '1. ', suffix: '', title: 'Numbered list' },
                          { label: '>', prefix: '> ', suffix: '', title: 'Quote' },
                        ].map((btn) => (
                          <Button
                            key={btn.label}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs font-semibold"
                            title={btn.title}
                            onClick={() => {
                              const ta = document.getElementById('desc-editor') as HTMLTextAreaElement;
                              if (!ta) return;
                              const start = ta.selectionStart;
                              const end = ta.selectionEnd;
                              const selected = description.substring(start, end);
                              const before = description.substring(0, start);
                              const after = description.substring(end);
                              const newText = before + btn.prefix + selected + btn.suffix + after;
                              setDescription(newText);
                              setTimeout(() => {
                                ta.focus();
                                const newPos = start + btn.prefix.length + selected.length + btn.suffix.length;
                                ta.setSelectionRange(newPos, newPos);
                              }, 0);
                            }}
                          >
                            {btn.label}
                          </Button>
                        ))}
                      </div>
                      <Textarea
                        id="desc-editor"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={8}
                        className="min-h-[180px] font-mono text-sm"
                        placeholder="Write the full course description using markdown…"
                      />
                    </CardContent>
                  </Card>
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
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Website URL</Label>
                      <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Responsible / Course Admin</Label>
                      <Select value={responsibleId || '__none__'} onValueChange={(v) => setResponsibleId(v === '__none__' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Select responsible" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.first_name} {u.last_name} ({u.email})
                            </SelectItem>
                          ))}
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

          <TabsContent value="quizzes" className="mt-6 space-y-4">
            <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
              <p className="text-sm text-primary">
                Manage <strong>quizzes</strong> linked to this course. Create, edit, or delete quizzes.
              </p>
            </Card>
            {quizzes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No quizzes for this course yet.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {quizzes.map((q: any) => (
                  <Card key={q.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.question_count ?? 0} questions &middot; Pass: {q.pass_percentage ?? 50}%
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/courses/${courseId}/quiz/${q.id}`}>Preview</Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        try { await api.delete(`/api/quizzes/${q.id}/`); setQuizzes(prev => prev.filter(x => x.id !== q.id)); } catch {}
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
