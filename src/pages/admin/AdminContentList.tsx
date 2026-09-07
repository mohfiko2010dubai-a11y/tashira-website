import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import AdminTopNav from '@/components/admin/AdminTopNav';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-200 text-gray-700',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  PUBLISHED: 'bg-green-600 text-white',
  ARCHIVED: 'bg-stone-300 text-stone-700',
};

export default function AdminContentList() {
  const [contentType, setContentType] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const query = trpc.content.list.useQuery({
    ...(contentType ? { contentType: contentType as 'LANDING' | 'GUIDE' | 'NEWS' } : {}),
    ...(language ? { language: language as 'en' | 'ar' } : {}),
    ...(status ? { status: status as 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED' } : {}),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminTopNav title="Content" subtitle="SEO, guides and visa news" />
      <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A1628]">Content</h1>
        <div className="flex gap-3">
          <Link to="/admin/content/review-queue" className="rounded-lg border border-[#C9A04C] px-4 py-2 text-sm font-semibold text-[#0A1628]">Review queue</Link>
          <Link to="/admin/content/redirects" className="rounded-lg border border-[#C9A04C] px-4 py-2 text-sm font-semibold text-[#0A1628]">Redirects</Link>
          <Link to="/admin/content/new" className="rounded-lg bg-[#C9A04C] px-4 py-2 text-sm font-semibold text-[#0A1628]">+ New content</Link>
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="rounded-lg border p-2 text-sm">
          <option value="">All types</option><option value="LANDING">Landing</option><option value="GUIDE">Guide</option><option value="NEWS">News</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border p-2 text-sm">
          <option value="">All languages</option><option value="en">English</option><option value="ar">العربية</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border p-2 text-sm">
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {query.isLoading && <p className="text-gray-500">Loading…</p>}
      {query.error && <p className="text-red-600">{query.error.message}</p>}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="p-2">Title</th><th className="p-2">Type</th><th className="p-2">Lang</th><th className="p-2">Slug</th><th className="p-2">Status</th><th className="p-2">v</th><th className="p-2">Updated</th><th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {query.data?.map((item) => (
            <tr key={item.id} className="border-b hover:bg-[#FAFAF7]">
              <td className="p-2 font-medium text-[#0A1628]">{item.title}{item.syntheticLabel === 1 && <span className="ms-2 rounded bg-amber-100 px-1 text-[10px] text-amber-800">SYNTHETIC</span>}</td>
              <td className="p-2">{item.contentType}</td>
              <td className="p-2">{item.language}</td>
              <td className="p-2 font-mono text-xs">/{item.slug}</td>
              <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[item.status]}`}>{item.status}</span></td>
              <td className="p-2">{item.version}</td>
              <td className="p-2 text-xs text-gray-500">{new Date(item.updatedAt).toLocaleString()}</td>
              <td className="p-2"><Link to={`/admin/content/${item.id}`} className="text-[#C9A04C] underline">Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      </main>
    </div>
  );
}
