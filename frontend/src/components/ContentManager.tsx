'use client';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

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

const ENTITY_TYPES = [
  { value: 'course', label: 'Course', icon: '📚', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  { value: 'module', label: 'Module', icon: '📦', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { value: 'lesson', label: 'Lesson', icon: '📝', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { value: 'quiz', label: 'Quiz', icon: '❓', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { value: 'video', label: 'Video', icon: '🎬', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  { value: 'resource', label: 'Resource', icon: '📎', color: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
] as const;

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {};
ENTITY_TYPES.forEach((t) => { TYPE_META[t.value] = { icon: t.icon, label: t.label, color: t.color }; });

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

  const deleteEntity = async (id: number, parentId?: number) => {
    if (!confirm('Delete this item and all its children?')) return;
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
      setExpanded((prev) => new Set([...prev, parentId]));
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
  if (loading) return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* ── LEFT: Tree + Create ── */}
      <div className="space-y-4">
        {error && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
        <CreateBar parentId={rootId} onSubmit={createStandalone} saving={saving} />
        <div className="glass-card max-h-[70vh] overflow-y-auto rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Content tree</h3>
          {tree.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No content yet. Create something above.</p>}
          {tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              selectedId={selected?.id ?? null}
              onToggle={toggleExpand}
              onSelect={selectNode}
              onDelete={deleteEntity}
              onDetach={detachChild}
              onAddChild={addChild}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Editor ── */}
      <div className="relative z-10 max-h-[80vh] space-y-4 overflow-y-auto">
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
          <div className="glass-card flex h-60 items-center justify-center rounded-2xl p-8">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">Select an item from the tree to edit it, or create a new one.</p>
          </div>
        )}
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
    <form onSubmit={submit} className="glass-card flex flex-wrap items-end gap-2 rounded-2xl p-4">
      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Create new</label>
        <div className="flex gap-1">
          <select value={type} onChange={(e) => setType(e.target.value)} className="glass-input text-sm">
            {types.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-[2] min-w-[180px]">
        <input placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} className="glass-input w-full text-sm" />
      </div>
      {(type === 'video' || type === 'resource') && (
        <div className="min-w-[120px]">
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-600 dark:file:text-blue-400" />
        </div>
      )}
      <button type="submit" disabled={saving || !title.trim()} className="btn-primary whitespace-nowrap text-sm">
        {saving ? '...' : '+ Create'}
      </button>
    </form>
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
  const meta = TYPE_META[node.entity_type] || { icon: '📄', label: node.entity_type, color: 'bg-gray-200 text-gray-700' };
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

  return (
    <div>
      <div
        role="treeitem"
        tabIndex={0}
        aria-label={`${meta.label}: ${node.title}`}
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-all cursor-pointer hover:bg-white/40 dark:hover:bg-white/5 ${isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(node); }}
      >
        {isContainer || hasChildren ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10">
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="inline-block h-5 w-5" />
        )}
        <span className="text-base leading-none">{meta.icon}</span>
        <span className="flex-1 truncate font-medium text-gray-900 dark:text-white">{node.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.color}`}>{meta.label}</span>
        <div className="ml-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isContainer && allowedChildren.length > 0 && (
            <button type="button" title="Add child" onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
              className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400">+</button>
          )}
          {parentId && onDetach && (
            <button type="button" title="Detach" onClick={(e) => { e.stopPropagation(); onDetach(parentId, node.id); }}
              className="rounded px-1 py-0.5 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">⛓</button>
          )}
          <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(node.id, parentId); }}
            className="rounded px-1 py-0.5 text-xs text-rose-500 hover:bg-rose-500/10">✕</button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={doAdd} className="flex items-center gap-1 py-1" style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}>
          <select value={addType} onChange={(e) => setAddType(e.target.value)} className="glass-input py-1 text-xs">
            <option value="">Type...</option>
            {allowedChildren.map((t) => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label}</option>)}
          </select>
          <input placeholder="Title" value={addTitle} onChange={(e) => setAddTitle(e.target.value)} className="glass-input flex-1 py-1 text-xs" />
          <button type="submit" disabled={saving || !addType || !addTitle.trim()} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
          <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-gray-400">✕</button>
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
  const meta = TYPE_META[node.entity_type] || { icon: '📄', label: node.entity_type, color: '' };
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
      <div className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit {meta.label}</h2>
              <p className="text-xs text-gray-500">ID: {node.id} &middot; {node.entity_type}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={togglePublish}
            disabled={saving}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              isPublished
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400'
            }`}
          >
            {isPublished ? '● Published' : '○ Draft'}
          </button>
        </div>

        <form onSubmit={saveBasic} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" className="glass-input w-full font-medium" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="glass-input w-full text-sm" />

          {node.entity_type === 'lesson' && (
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Lesson body / content" rows={4} className="glass-input w-full text-sm" />
          )}

          {node.entity_type === 'video' && (
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Video URL (or upload below)" className="glass-input w-full text-sm" />
          )}

          {node.entity_type === 'resource' && (
            <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="Resource URL (or upload below)" className="glass-input w-full text-sm" />
          )}

          {(node.entity_type === 'video' || node.entity_type === 'resource' || node.entity_type === 'lesson') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Upload file to S3</label>
              <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 dark:file:text-blue-400" />
              {file && <p className="mt-1 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
            </div>
          )}

          {node.entity_type === 'quiz' && (
            <>
              <input type="number" value={passPct} onChange={(e) => setPassPct(e.target.value)} placeholder="Pass %" className="glass-input w-32 text-sm" />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Questions</h4>
                {questions.map((q, qi) => (
                  <div key={qi} className="rounded-xl border border-white/10 p-3 dark:border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 text-xs font-bold text-gray-400">Q{qi + 1}</span>
                      <input value={q.question_text} onChange={(e) => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], question_text: e.target.value }; return c; })}
                        placeholder="Question text" required className="glass-input flex-1 text-sm" />
                      <button type="button" onClick={() => removeQuestion(qi)} className="mt-1 text-xs text-rose-500">✕</button>
                    </div>
                    {q.options.map((o, oi) => (
                      <div key={oi} className="mt-1.5 flex items-center gap-2 pl-6">
                        <input type="radio" name={`q${node.id}-${qi}`} checked={o.is_correct}
                          onChange={() => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], options: c[qi].options.map((op, k) => ({ ...op, is_correct: k === oi })) }; return c; })} />
                        <input value={o.option_text} onChange={(e) => setQuestions((prev) => { const c = [...prev]; c[qi] = { ...c[qi], options: c[qi].options.map((op, k) => k === oi ? { ...op, option_text: e.target.value } : op) }; return c; })}
                          placeholder={`Option ${oi + 1}`} required className="glass-input flex-1 text-sm" />
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(qi)} className="ml-6 mt-1 text-xs text-blue-600 dark:text-blue-400">+ Option</button>
                  </div>
                ))}
                <button type="button" onClick={addQuestion} className="text-xs font-medium text-blue-600 dark:text-blue-400">+ Add question</button>
              </div>
            </>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </div>

      {/* Attachments */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Attachments &amp; Files</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Upload any file (video, PDF, image, doc) to S3</p>
        <div className="mt-3 flex items-end gap-2">
          <input ref={attachRef} type="file" className="block flex-1 text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 dark:file:text-blue-400" />
          <button type="button" onClick={doUpload} disabled={saving} className="btn-primary whitespace-nowrap text-sm">Upload</button>
        </div>
        {node.attachments && node.attachments.length > 0 && (
          <ul className="mt-3 divide-y divide-white/10 dark:divide-white/5">
            {node.attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{att.title}</p>
                  {att.file_url && <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400">View file</a>}
                </div>
                <button type="button" onClick={() => onDeleteAttachment(att.id)} className="ml-2 text-xs text-rose-500 hover:text-rose-600">Remove</button>
              </li>
            ))}
          </ul>
        )}
        {(!node.attachments || node.attachments.length === 0) && <p className="mt-2 text-xs text-gray-400">No attachments.</p>}
      </div>

      {/* Quick add children */}
      {allowedChildren.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add content inside this {meta.label.toLowerCase()}</h3>
          <QuickAddChild parentId={node.id} allowedTypes={allowedChildren} onAdd={onAddChild} saving={saving} />
          {node.children && node.children.length > 0 && (
            <ul className="mt-3 divide-y divide-white/10 dark:divide-white/5">
              {node.children.map((child) => {
                const cm = TYPE_META[child.entity_type] || { icon: '📄', label: child.entity_type, color: '' };
                return (
                  <li key={child.id} className="flex items-center gap-2 py-2">
                    <span>{cm.icon}</span>
                    <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{child.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cm.color}`}>{cm.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
      <select value={type} onChange={(e) => setType(e.target.value)} className="glass-input py-1.5 text-sm">
        {allowedTypes.map((t) => <option key={t} value={t}>{TYPE_META[t]?.icon} {TYPE_META[t]?.label}</option>)}
      </select>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="glass-input flex-1 py-1.5 text-sm" />
      {(type === 'video' || type === 'resource') && (
        <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-40 text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-blue-500/10 file:px-2 file:py-1 file:text-xs file:text-blue-600" />
      )}
      <button type="submit" disabled={saving || !title.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">+ Add</button>
    </form>
  );
}
