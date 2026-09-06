import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';

type Status = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

const TRANSITION_BUTTONS: Record<Status, { action: string; label: string }[]> = {
  DRAFT: [{ action: 'submit', label: 'Submit for review' }],
  IN_REVIEW: [{ action: 'approve', label: 'Approve' }, { action: 'return_to_draft', label: 'Return to draft' }],
  APPROVED: [{ action: 'publish', label: 'Publish' }, { action: 'return_to_draft', label: 'Return to draft' }],
  PUBLISHED: [{ action: 'unpublish', label: 'Unpublish' }, { action: 'archive', label: 'Archive' }],
  ARCHIVED: [{ action: 'return_to_draft', label: 'Restore to draft' }],
};

const inputCls = 'w-full rounded-lg border p-2 text-sm';
const labelCls = 'mb-1 block text-xs font-semibold text-gray-600';

export default function AdminContentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const itemId = id ? Number(id) : 0;

  const existing = trpc.content.byId.useQuery({ id: itemId }, { enabled: !isNew });
  const history = trpc.content.history.useQuery({ id: itemId }, { enabled: !isNew });
  const utils = trpc.useUtils();

  const [form, setForm] = useState<Record<string, string>>({
    contentType: 'LANDING', language: 'en', translationGroupId: '', title: '', slug: '',
    excerpt: '', bodyBlocks: '[]', heroImage: '', heroImageAlt: '', category: '', tags: '',
    author: '', reviewer: '', sourceAuthority: '', sourceUrl: '', sourcePublishedAt: '', lastVerifiedAt: '',
    seoTitle: '', metaDescription: '', canonicalUrl: '', robots: 'index,follow',
    ogTitle: '', ogDescription: '', ogImage: '', syntheticLabel: '',
  });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const [loadedId, setLoadedId] = useState<number | null>(null);
  if (existing.data && loadedId !== existing.data.id) {
    setLoadedId(existing.data.id);
    const d = existing.data;
    setForm({
      contentType: d.contentType, language: d.language, translationGroupId: d.translationGroupId,
      title: d.title, slug: d.slug, excerpt: d.excerpt ?? '',
      bodyBlocks: JSON.stringify(d.bodyBlocks, null, 2),
      heroImage: d.heroImage ?? '', heroImageAlt: d.heroImageAlt ?? '', category: d.category ?? '',
      tags: Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : '',
      author: d.author ?? '', reviewer: d.reviewer ?? '', sourceAuthority: d.sourceAuthority ?? '',
      sourceUrl: d.sourceUrl ?? '',
      sourcePublishedAt: d.sourcePublishedAt ? String(d.sourcePublishedAt).slice(0, 10) : '',
      lastVerifiedAt: d.lastVerifiedAt ? String(d.lastVerifiedAt).slice(0, 10) : '',
      seoTitle: d.seoTitle ?? '', metaDescription: d.metaDescription ?? '', canonicalUrl: d.canonicalUrl ?? '',
      robots: d.robots, ogTitle: d.ogTitle ?? '', ogDescription: d.ogDescription ?? '', ogImage: d.ogImage ?? '',
      syntheticLabel: d.syntheticLabel === 1 ? '1' : '',
    });
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const buildPayload = () => {
    let bodyBlocks: unknown;
    try {
      bodyBlocks = JSON.parse(form.bodyBlocks || '[]');
    } catch {
      throw new Error('Body blocks must be valid JSON');
    }
    const str = (v: string) => (v.trim() ? v.trim() : undefined);
    return {
      contentType: form.contentType as 'LANDING' | 'GUIDE' | 'NEWS',
      language: form.language as 'en' | 'ar',
      translationGroupId: form.translationGroupId || `grp-${form.language}-${form.slug}`,
      title: form.title,
      slug: form.slug.replace(/^\//, ''),
      excerpt: str(form.excerpt),
      bodyBlocks,
      heroImage: str(form.heroImage),
      heroImageAlt: str(form.heroImageAlt),
      category: str(form.category),
      tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      author: str(form.author), reviewer: str(form.reviewer),
      sourceAuthority: str(form.sourceAuthority), sourceUrl: str(form.sourceUrl),
      sourcePublishedAt: str(form.sourcePublishedAt), lastVerifiedAt: str(form.lastVerifiedAt),
      seoTitle: str(form.seoTitle), metaDescription: str(form.metaDescription),
      canonicalUrl: str(form.canonicalUrl), robots: form.robots || 'index,follow',
      ogTitle: str(form.ogTitle), ogDescription: str(form.ogDescription), ogImage: str(form.ogImage),
      syntheticLabel: form.syntheticLabel === '1',
    };
  };

  const createMut = trpc.content.create.useMutation({
    onSuccess: (item) => { utils.content.list.invalidate(); navigate(`/admin/content/${item.id}`); },
    onError: (e) => setError(e.message),
  });
  const updateMut = trpc.content.update.useMutation({
    onSuccess: () => { setSaved('Saved.'); setError(''); utils.content.list.invalidate(); existing.refetch(); history.refetch(); },
    onError: (e) => { setError(e.message); setSaved(''); },
  });
  const transitionMut = trpc.content.transition.useMutation({
    onSuccess: () => { utils.content.list.invalidate(); existing.refetch(); history.refetch(); },
    onError: (e) => setError(e.message),
  });

  const save = () => {
    setError(''); setSaved('');
    try {
      const payload = buildPayload();
      if (isNew) {
        createMut.mutate(payload);
      } else {
        updateMut.mutate({ id: itemId, expectedVersion: existing.data!.version, ...payload });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input');
    }
  };

  if (!isNew && existing.isLoading) return <div className="p-6">Loading…</div>;

  const status = existing.data?.status as Status | undefined;
  const transitions = status ? TRANSITION_BUTTONS[status] : [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A1628]">{isNew ? 'New content' : `Edit: ${existing.data?.title ?? ''}`}</h1>
        <Link to="/admin/content" className="text-sm text-[#C9A04C] underline">← Back to list</Link>
      </div>

      {!isNew && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-white p-3">
          <span className="text-sm font-semibold">Status: {status} (v{existing.data?.version})</span>
          {transitions.map((tr) => (
            <button
              key={tr.action}
              onClick={() => transitionMut.mutate({ id: itemId, action: tr.action as never, expectedVersion: existing.data!.version })}
              className="rounded-lg bg-[#0A1628] px-3 py-1.5 text-xs font-semibold text-white"
            >
              {tr.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{saved}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div><label className={labelCls}>Type</label>
          <select className={inputCls} value={form.contentType} onChange={set('contentType')}>
            <option value="LANDING">Landing</option><option value="GUIDE">Guide</option><option value="NEWS">News</option>
          </select></div>
        <div><label className={labelCls}>Language</label>
          <select className={inputCls} value={form.language} onChange={set('language')}>
            <option value="en">English</option><option value="ar">العربية</option>
          </select></div>
        <div><label className={labelCls}>Title *</label><input className={inputCls} value={form.title} onChange={set('title')} /></div>
        <div><label className={labelCls}>Slug * (e.g. uae-visa/14-days)</label><input className={inputCls} dir="ltr" value={form.slug} onChange={set('slug')} /></div>
        <div><label className={labelCls}>Translation group ID</label><input className={inputCls} dir="ltr" value={form.translationGroupId} onChange={set('translationGroupId')} placeholder="shared between en/ar pair" /></div>
        <div><label className={labelCls}>Category</label><input className={inputCls} value={form.category} onChange={set('category')} /></div>
        <div className="col-span-2"><label className={labelCls}>Excerpt</label><textarea className={inputCls} rows={2} value={form.excerpt} onChange={set('excerpt')} /></div>
        <div className="col-span-2"><label className={labelCls}>Body blocks (JSON: heading/paragraph/list/faq/cta) *</label>
          <textarea className={`${inputCls} font-mono`} dir="ltr" rows={12} value={form.bodyBlocks} onChange={set('bodyBlocks')} /></div>
        <div><label className={labelCls}>Hero image URL</label><input className={inputCls} dir="ltr" value={form.heroImage} onChange={set('heroImage')} /></div>
        <div><label className={labelCls}>Hero image alt text</label><input className={inputCls} value={form.heroImageAlt} onChange={set('heroImageAlt')} /></div>
        <div className="col-span-2"><label className={labelCls}>Tags (comma separated)</label><input className={inputCls} value={form.tags} onChange={set('tags')} /></div>

        <div><label className={labelCls}>Author</label><input className={inputCls} value={form.author} onChange={set('author')} /></div>
        <div><label className={labelCls}>Reviewer</label><input className={inputCls} value={form.reviewer} onChange={set('reviewer')} /></div>
        <div><label className={labelCls}>Source authority</label><input className={inputCls} value={form.sourceAuthority} onChange={set('sourceAuthority')} placeholder="e.g. ICP, GDRFA" /></div>
        <div><label className={labelCls}>Source URL</label><input className={inputCls} dir="ltr" value={form.sourceUrl} onChange={set('sourceUrl')} /></div>
        <div><label className={labelCls}>Source published at (YYYY-MM-DD)</label><input className={inputCls} dir="ltr" value={form.sourcePublishedAt} onChange={set('sourcePublishedAt')} /></div>
        <div><label className={labelCls}>Last verified at (YYYY-MM-DD)</label><input className={inputCls} dir="ltr" value={form.lastVerifiedAt} onChange={set('lastVerifiedAt')} /></div>

        <div><label className={labelCls}>SEO title</label><input className={inputCls} value={form.seoTitle} onChange={set('seoTitle')} /></div>
        <div><label className={labelCls}>Canonical URL</label><input className={inputCls} dir="ltr" value={form.canonicalUrl} onChange={set('canonicalUrl')} /></div>
        <div className="col-span-2"><label className={labelCls}>Meta description</label><textarea className={inputCls} rows={2} value={form.metaDescription} onChange={set('metaDescription')} /></div>
        <div><label className={labelCls}>Robots</label><input className={inputCls} dir="ltr" value={form.robots} onChange={set('robots')} /></div>
        <div><label className={labelCls}>OG title</label><input className={inputCls} value={form.ogTitle} onChange={set('ogTitle')} /></div>
        <div><label className={labelCls}>OG description</label><input className={inputCls} value={form.ogDescription} onChange={set('ogDescription')} /></div>
        <div><label className={labelCls}>OG image</label><input className={inputCls} dir="ltr" value={form.ogImage} onChange={set('ogImage')} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <input id="synthetic" type="checkbox" checked={form.syntheticLabel === '1'} onChange={(e) => setForm((f) => ({ ...f, syntheticLabel: e.target.checked ? '1' : '' }))} />
          <label htmlFor="synthetic" className="text-sm">Synthetic staging content (shows STAGING_TEST_SYNTHETIC_NOT_REGULATORY banner)</label>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={createMut.isPending || updateMut.isPending}
          className="rounded-xl bg-[#C9A04C] px-8 py-3 font-bold text-[#0A1628] disabled:opacity-50">
          {isNew ? 'Create draft' : 'Save changes'}
        </button>
      </div>

      {!isNew && history.data && history.data.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-[#0A1628]">Version history (immutable)</h2>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b text-left text-gray-500"><th className="p-2">v</th><th className="p-2">Status</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {history.data.map((v) => (
                <tr key={v.id} className="border-b">
                  <td className="p-2">{v.version}</td><td className="p-2">{v.status}</td>
                  <td className="p-2">{v.action}</td><td className="p-2">{v.actor}</td>
                  <td className="p-2 text-xs text-gray-500">{new Date(v.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
