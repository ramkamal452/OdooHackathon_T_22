'use client';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  X,
  Link2,
} from 'lucide-react';

/* ================================================================
   Types
   ================================================================ */

interface Attachment {
  id: number;
  title: string;
  file_url?: string;
  external_url?: string;
}

interface QuizOption {
  id?: number;
  option_text: string;
  is_correct: boolean;
  sort_order?: number;
}

interface QuizQuestion {
  id?: number;
  question_text: string;
  marks?: number;
  sort_order?: number;
  options: QuizOption[];
}

interface TreeNode {
  id: number;
  entity_type: string;
  entity_type_code: number;
  title: string;
  description?: string;
  short_description?: string;
  status?: number;
  children?: TreeNode[];
  children_count?: number;
  sort_order?: number;
  is_preview?: boolean;
  link_id?: number;
  video_url?: string;
  resource_url?: string;
  file_url?: string;
  resource_kind?: number;
  body?: string;
  pass_percentage?: number;
  questions?: QuizQuestion[];
  attachments?: Attachment[];
  duration_seconds?: number;
  allow_download?: boolean;
  created_at?: string;
}

type EntityBadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const ENTITY_TYPES = [
  { value: 'course', label: 'Course', icon: '📚', badgeVariant: 'secondary' as const },
  { value: 'module', label: 'Module', icon: '📦', badgeVariant: 'outline' as const },
  { value: 'lesson', label: 'Lesson', icon: '📝', badgeVariant: 'default' as const },
  { value: 'quiz', label: 'Quiz', icon: '❓', badgeVariant: 'secondary' as const },
  { value: 'video', label: 'Video', icon: '🎬', badgeVariant: 'destructive' as const },
  { value: 'resource', label: 'Resource', icon: '📎', badgeVariant: 'outline' as const },
] as const;

const TYPE_META: Record<string, { icon: string; badgeVariant: EntityBadgeVariant; label: string }> = {};
ENTITY_TYPES.forEach((t) => {
  TYPE_META[t.value] = { icon: t.icon, label: t.label, badgeVariant: t.badgeVariant };
});

const CONTAINER_TYPES = new Set(['course', 'module', 'lesson']);

const CHILD_TYPES: Record<string, string[]> = {
  course: ['module', 'lesson', 'quiz', 'video', 'resource'],
  module: ['lesson', 'quiz', 'video', 'resource'],
  lesson: ['quiz', 'video', 'resource'],
};

interface ContentManagerProps {
  rootId?: number;
  rootType?: string;
}

/* ================================================================
   Main Component
   ================================================================ */

export default function ContentManager({ rootId, rootType }: ContentManagerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; parentId?: number } | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (rootId) {
        const { data } = await api.get<TreeNode>(`/api/cm/entities/${rootId}/`);
        setTree(data.children || []);
        if (data.children?.length && !selected) {
          setExpanded(new Set(data.children.filter(c => c.children && c.children.length > 0).map(c => c.id)));
        }
      } else {
        const url = rootType ? `/api/cm/tree/?type=${rootType}` : '/api/cm/tree/';
        const { data } = await api.get<TreeNode[]>(url);
        setTree(data);
      }
    } catch {
      setError('Failed to load content.');
    } finally {
      setLoading(false);
    }
  }, [rootId, rootType]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const refreshSelected = useCallback(async (id: number) => {
    try {
      const { data } = await api.get<TreeNode>(`/api/cm/entities/${id}/`);
      setSelected(data);
    } catch { /* ignore */ }
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectNode = async (node: TreeNode) => {
    try {
      const { data } = await api.get<TreeNode>(`/api/cm/entities/${node.id}/`);
      setSelected(data);
    } catch {
      setSelected(node);
    }
  };

  const requestDelete = (id: number, parentId?: number) => {
    setDeleteTarget({ id, parentId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, parentId } = deleteTarget;
    setDeleteTarget(null);
    setSaving(true);
    try {
      if (parentId) {
        await api.delete(`/api/cm/entities/${parentId}/children/${id}/`);
      }
      await api.delete(`/api/cm/entities/${id}/`);
      if (selected?.id === id) setSelected(null);
      await loadTree();
    } catch {
      setError('Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  const detachChild = async (parentId: number, childId: number) => {
    setSaving(true);
    try {
      await api.delete(`/api/cm/entities/${parentId}/children/${childId}/`);
      await loadTree();
      if (selected?.id === parentId) await refreshSelected(parentId);
    } catch {
      setError('Detach failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Add child ── */
  const addChild = async (parentId: number, childType: string, title: string, extraData?: Record<string, unknown>, file?: File) => {
    setSaving(true);
    setError(null);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('entity_type', childType);
        fd.append('title', title);
        fd.append('file', file);
        if (extraData) {
          Object.entries(extraData).forEach(([k, v]) => {
            if (v !== undefined && v !== null) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
        }
        await api.post(`/api/cm/entities/${parentId}/children/`, fd);
      } else {
        await api.post(`/api/cm/entities/${parentId}/children/`, {
          entity_type: childType,
          title,
          ...extraData,
        });
      }
      await loadTree();
      if (selected?.id === parentId) await refreshSelected(parentId);
      setExpanded((prev) => new Set([...Array.from(prev), parentId]));
    } catch {
      setError('Failed to add child.');
    } finally {
      setSaving(false);
    }
  };

  const createStandalone = async (childType: string, title: string, parentId?: number, extraData?: Record<string, unknown>, file?: File) => {
    setSaving(true);
    setError(null);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('entity_type', childType);
        fd.append('title', title);
        fd.append('file', file);
        if (parentId) fd.append('parent_id', String(parentId));
        if (extraData) {
          Object.entries(extraData).forEach(([k, v]) => {
            if (v !== undefined && v !== null) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
        }
        await api.post('/api/cm/entities/', fd);
      } else {
        await api.post('/api/cm/entities/', {
          entity_type: childType,
          title,
          parent_id: parentId,
          ...extraData,
        });
      }
      await loadTree();
    } catch {
      setError('Failed to create.');
    } finally {
      setSaving(false);
    }
  };

  const updateEntity = async (id: number, data: Record<string, unknown>, file?: File) => {
    setSaving(true);
    setError(null);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        await api.put(`/api/cm/entities/${id}/`, fd);
      } else {
        await api.put(`/api/cm/entities/${id}/`, data);
      }
      await refreshSelected(id);
      await loadTree();
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async (entityId: number, file: File) => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/api/cm/entities/${entityId}/upload/`, fd);
      await refreshSelected(entityId);
    } catch {
      setError('Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteAttachment = async (attId: number) => {
    setSaving(true);
    try {
      await api.delete(`/api/cm/attachments/${attId}/`);
      if (selected) await refreshSelected(selected.id);
    } catch {
      setError('Delete attachment failed.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete item"
        description="Delete this item and all its children? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />

      {/* ── LEFT: Tree + Create ── */}
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <CreateBar parentId={rootId} onSubmit={createStandalone} saving={saving} />
        <Card className="rounded-lg">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[70vh]">
              <div className="p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Content tree
                </h3>
                {tree.length === 0 && (
                  <p className="text-sm text-muted-foreground">No content yet. Create something above.</p>
                )}
                {tree.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    selectedId={selected?.id ?? null}
                    onToggle={toggleExpand}
                    onSelect={selectNode}
                    onDelete={requestDelete}
                    onDetach={detachChild}
                    onAddChild={addChild}
                    saving={saving}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── RIGHT: Editor ── */}
      <div className="relative z-10 space-y-4">
        <ScrollArea className="h-[80vh]">
          <div className="space-y-4 pr-4">
            {selected ? (
              <EntityEditor
                node={selected}
                onUpdate={updateEntity}
                onUpload={uploadAttachment}
                onDeleteAttachment={deleteAttachment}
                onAddChild={addChild}
                saving={saving}
              />
            ) : (
              <Card className="rounded-lg">
                <CardContent className="flex h-60 items-center justify-center p-8">
                  <p className="text-center text-sm text-muted-foreground">
                    Select an item from the tree to edit it, or create a new one.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

/* ================================================================
   Create Bar — quick-create any entity type
   ================================================================ */

function CreateBar({ parentId, onSubmit, saving }: {
  parentId?: number;
  onSubmit: (type: string, title: string, parentId?: number, extra?: Record<string, unknown>, file?: File) => Promise<void>;
  saving: boolean;
}) {
  const [type, setType] = useState('module');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit(type, title.trim(), parentId, undefined, file || undefined);
    setTitle('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const types = ENTITY_TYPES.filter((t) => t.value !== 'course');

  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">Create new</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? 'module')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] flex-[2]">
            <Input
              placeholder="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm"
            />
          </div>
          {(type === 'video' || type === 'resource') && (
            <div className="min-w-[120px]">
              <Input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
              />
            </div>
          )}
          <Button type="submit" disabled={saving || !title.trim()} variant="default" className="whitespace-nowrap text-sm">
            {saving ? '...' : '+ Create'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ================================================================
   Tree Item — recursive
   ================================================================ */

function TreeItem({
  node, depth, expanded, selectedId, onToggle, onSelect, onDelete, onDetach, onAddChild, saving, parentId,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<number>;
  selectedId: number | null;
  onToggle: (id: number) => void;
  onSelect: (node: TreeNode) => void;
  onDelete: (id: number, parentId?: number) => void;
  onDetach?: (parentId: number, childId: number) => void;
  onAddChild: (parentId: number, childType: string, title: string, extra?: Record<string, unknown>, file?: File) => Promise<void>;
  saving: boolean;
  parentId?: number;
}) {
  const meta = TYPE_META[node.entity_type] || { icon: '📄', label: node.entity_type, badgeVariant: 'outline' as EntityBadgeVariant };
  const hasChildren = (node.children && node.children.length > 0) || (node.children_count && node.children_count > 0);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isContainer = CONTAINER_TYPES.has(node.entity_type);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('');
  const [addTitle, setAddTitle] = useState('');

  const allowedChildren = CHILD_TYPES[node.entity_type] || [];

  const doAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim() || !addType) return;
    await onAddChild(node.id, addType, addTitle.trim());
    setAddTitle('');
    setShowAdd(false);
  };

  const addTypeSelectValue = addType || '__none__';

  return (
    <div>
      <div
        role="treeitem"
        tabIndex={0}
        aria-label={`${meta.label}: ${node.title}`}
        className={`group flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-muted/50 ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(node); }}
      >
        {isContainer || hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 shrink-0 rounded text-xs text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
          >
            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}
        <span className="text-base leading-none">{meta.icon}</span>
        <span className="flex-1 truncate font-medium text-foreground">{node.title}</span>
        <Badge variant={meta.badgeVariant} className="text-[10px] font-semibold uppercase">
          {meta.label}
        </Badge>
        <div className="ml-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isContainer && allowedChildren.length > 0 && (
            <Button
              type="button"
              title="Add child"
              variant="ghost"
              size="icon-xs"
              className="text-primary hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
          {parentId && onDetach && (
            <Button
              type="button"
              title="Detach"
              variant="ghost"
              size="icon-xs"
              className="text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              onClick={(e) => { e.stopPropagation(); onDetach(parentId, node.id); }}
            >
              <Link2 className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            title="Delete"
            variant="ghost"
            size="icon-xs"
            className="text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id, parentId); }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={doAdd} className="flex items-center gap-1 py-1" style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}>
          <Select
            value={addTypeSelectValue}
            onValueChange={(v) => setAddType(v === '__none__' || v == null ? '' : v)}
          >
            <SelectTrigger className="h-7 min-w-[100px] text-xs">
              <SelectValue placeholder="Type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Type...</SelectItem>
              {allowedChildren.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_META[t]?.icon} {TYPE_META[t]?.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Title"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            className="flex-1 py-1 text-xs"
          />
          <Button type="submit" size="xs" disabled={saving || !addType || !addTitle.trim()}>
            Add
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => setShowAdd(false)}>
            <X className="size-3.5" />
          </Button>
        </form>
      )}

      {isExpanded && node.children?.map((child) => (
        <TreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
          onDelete={onDelete}
          onDetach={onDetach}
          onAddChild={onAddChild}
          saving={saving}
          parentId={node.id}
        />
      ))}
    </div>
  );
}

/* ================================================================
   Entity Editor — right panel, adapts per entity type
   ================================================================ */

function EntityEditor({
  node, onUpdate, onUpload, onDeleteAttachment, onAddChild, saving,
}: {
  node: TreeNode;
  onUpdate: (id: number, data: Record<string, unknown>, file?: File) => Promise<void>;
  onUpload: (entityId: number, file: File) => Promise<void>;
  onDeleteAttachment: (attId: number) => Promise<void>;
  onAddChild: (parentId: number, childType: string, title: string, extra?: Record<string, unknown>, file?: File) => Promise<void>;
  saving: boolean;
}) {
  const meta = TYPE_META[node.entity_type] || { icon: '📄', label: node.entity_type, badgeVariant: 'outline' as EntityBadgeVariant };
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || '');
  const [body, setBody] = useState(node.body || '');
  const [videoUrl, setVideoUrl] = useState(node.video_url || '');
  const [resourceUrl, setResourceUrl] = useState(node.resource_url || '');
  const [passPct, setPassPct] = useState(String(node.pass_percentage || 50));
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<QuizQuestion[]>(node.questions || []);
  const [isPublished, setIsPublished] = useState(node.status === 2);

  useEffect(() => {
    setTitle(node.title);
    setDescription(node.description || '');
    setBody(node.body || '');
    setVideoUrl(node.video_url || '');
    setResourceUrl(node.resource_url || '');
    setPassPct(String(node.pass_percentage || 50));
    setQuestions(node.questions || []);
    setIsPublished(node.status === 2);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [node.id]);

  const saveBasic = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { title, description, is_published: isPublished };
    if (node.entity_type === 'lesson') payload.body = body;
    if (node.entity_type === 'video') payload.video_url = videoUrl;
    if (node.entity_type === 'resource') payload.resource_url = resourceUrl;
    if (node.entity_type === 'quiz') {
      payload.pass_percentage = Number(passPct);
      payload.questions = questions;
    }
    await onUpdate(node.id, payload, file || undefined);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const togglePublish = async () => {
    const next = !isPublished;
    setIsPublished(next);
    await onUpdate(node.id, { is_published: next });
  };

  const doUpload = async () => {
    if (!attachRef.current?.files?.[0]) return;
    await onUpload(node.id, attachRef.current.files[0]);
    attachRef.current.value = '';
  };

  const addQuestion = () => setQuestions((q) => [...q, { question_text: '', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }]);
  const addOption = (qi: number) => setQuestions((prev) => {
    const c = [...prev]; c[qi] = { ...c[qi], options: [...c[qi].options, { option_text: '', is_correct: false }] }; return c;
  });
  const removeQuestion = (qi: number) => setQuestions((prev) => prev.filter((_, i) => i !== qi));

  const allowedChildren = CHILD_TYPES[node.entity_type] || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rounded-lg">
        <CardContent className="space-y-3 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-foreground">Edit {meta.label}</h2>
                <p className="text-xs text-muted-foreground">ID: {node.id} &middot; {node.entity_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPublished ? 'default' : 'secondary'}>
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
              <Button
                type="button"
                onClick={togglePublish}
                disabled={saving}
                variant="outline"
                size="sm"
              >
                {isPublished ? 'Unpublish' : 'Publish'}
              </Button>
            </div>
          </div>

          <Separator />

          <form onSubmit={saveBasic} className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" className="w-full font-medium" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full text-sm" />

            {node.entity_type === 'lesson' && (
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Lesson body / content" rows={4} className="w-full text-sm" />
            )}

            {node.entity_type === 'video' && (
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Video URL (or upload below)" className="w-full text-sm" />
            )}

            {node.entity_type === 'resource' && (
              <Input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="Resource URL (or upload below)" className="w-full text-sm" />
            )}

            {(node.entity_type === 'video' || node.entity_type === 'resource' || node.entity_type === 'lesson') && (
              <div>
                <Label className="mb-1 block text-xs font-medium text-muted-foreground">Upload file to S3</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                />
                {file && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}

            {node.entity_type === 'quiz' && (
              <>
                <Input type="number" value={passPct} onChange={(e) => setPassPct(e.target.value)} placeholder="Pass %" className="w-32 text-sm" />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Questions</h4>
                  {questions.map((q, qi) => (
                    <div key={qi} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-2 text-xs font-bold text-muted-foreground">Q{qi + 1}</span>
                        <Input
                          value={q.question_text}
                          onChange={(e) => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], question_text: e.target.value }; return c; })}
                          placeholder="Question text"
                          required
                          className="flex-1 text-sm"
                        />
                        <Button type="button" variant="ghost" size="icon-xs" className="mt-1 text-destructive" onClick={() => removeQuestion(qi)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      {q.options.map((o, oi) => (
                        <div key={oi} className="mt-1.5 flex items-center gap-2 pl-6">
                          <input
                            type="radio"
                            name={`q${node.id}-${qi}`}
                            checked={o.is_correct}
                            onChange={() => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], options: c[qi].options.map((op, k) => ({ ...op, is_correct: k === oi })) }; return c; })}
                            className="accent-primary"
                          />
                          <Input
                            value={o.option_text}
                            onChange={(e) => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], options: c[qi].options.map((op, k) => k === oi ? { ...op, option_text: e.target.value } : op) }; return c; })}
                            placeholder={`Option ${oi + 1}`}
                            required
                            className="flex-1 text-sm"
                          />
                        </div>
                      ))}
                      <Button type="button" variant="link" size="xs" className="ml-6 mt-1 h-auto p-0 text-primary" onClick={() => addOption(qi)}>
                        + Option
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="link" size="xs" className="h-auto p-0 text-primary" onClick={addQuestion}>
                    + Add question
                  </Button>
                </div>
              </>
            )}

            <Button type="submit" disabled={saving} variant="default" className="w-full">
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card className="rounded-lg">
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-semibold text-foreground">Attachments &amp; Files</h3>
          <p className="text-xs text-muted-foreground">Upload any file (video, PDF, image, doc) to S3</p>
          <div className="mt-3 flex items-end gap-2">
            <Input
              ref={attachRef}
              type="file"
              className="block flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
            />
            <Button type="button" onClick={doUpload} disabled={saving} variant="default" className="whitespace-nowrap text-sm">
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
          {node.attachments && node.attachments.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {node.attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{att.title}</p>
                    {att.file_url && (
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-primary hover:underline">
                        View file
                      </a>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="ml-2 h-auto shrink-0 p-0 text-destructive hover:text-destructive"
                    onClick={() => onDeleteAttachment(att.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {(!node.attachments || node.attachments.length === 0) && (
            <p className="mt-2 text-xs text-muted-foreground">No attachments.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick add children */}
      {allowedChildren.length > 0 && (
        <Card className="rounded-lg">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Add content inside this {meta.label.toLowerCase()}
            </h3>
            <QuickAddChild parentId={node.id} allowedTypes={allowedChildren} onAdd={onAddChild} saving={saving} />
            {node.children && node.children.length > 0 && (
              <ul className="mt-3 divide-y divide-border">
                {node.children.map((child) => {
                  const cm = TYPE_META[child.entity_type] || { icon: '📄', label: child.entity_type, badgeVariant: 'outline' as EntityBadgeVariant };
                  return (
                    <li key={child.id} className="flex items-center gap-2 py-2">
                      <span>{cm.icon}</span>
                      <span className="flex-1 truncate text-sm font-medium text-foreground">{child.title}</span>
                      <Badge variant={cm.badgeVariant} className="text-[10px] font-semibold uppercase">
                        {cm.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   Quick Add Child — small inline form
   ================================================================ */

function QuickAddChild({ parentId, allowedTypes, onAdd, saving }: {
  parentId: number;
  allowedTypes: string[];
  onAdd: (parentId: number, childType: string, title: string, extra?: Record<string, unknown>, file?: File) => Promise<void>;
  saving: boolean;
}) {
  const [type, setType] = useState(allowedTypes[0] || '');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type) return;
    await onAdd(parentId, type, title.trim(), undefined, file || undefined);
    setTitle('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <Select value={type} onValueChange={(v) => setType(v ?? allowedTypes[0] ?? '')}>
        <SelectTrigger className="py-1.5 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowedTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_META[t]?.icon} {TYPE_META[t]?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="min-w-[120px] flex-1 py-1.5 text-sm"
      />
      {(type === 'video' || type === 'resource') && (
        <Input
          ref={fileRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-40 text-xs text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:text-primary"
        />
      )}
      <Button type="submit" disabled={saving || !title.trim()} variant="default" className="text-sm">
        + Add
      </Button>
    </form>
  );
}
