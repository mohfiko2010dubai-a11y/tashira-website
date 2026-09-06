import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';

/** Same-site redirect manager (SEO Manager / Owner). External targets are rejected server-side. */
export default function AdminContentRedirects() {
  const utils = trpc.useUtils();
  const query = trpc.content.listRedirects.useQuery();
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  const [statusCode, setStatusCode] = useState<'301' | '302'>('301');
  const [error, setError] = useState('');

  const createMut = trpc.content.createRedirect.useMutation({
    onSuccess: () => { setFromPath(''); setToPath(''); setError(''); utils.content.listRedirects.invalidate(); },
    onError: (e) => setError(e.message),
  });
  const deactivateMut = trpc.content.deactivateRedirect.useMutation({
    onSuccess: () => utils.content.listRedirects.invalidate(),
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    setError('');
    if (!fromPath.startsWith('/') || !toPath.startsWith('/')) {
      setError('Both paths must be same-site absolute paths starting with /');
      return;
    }
    createMut.mutate({ fromPath, toPath, statusCode: Number(statusCode) as 301 | 302 });
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A1628]">Redirects</h1>
        <Link to="/admin/content" className="text-sm text-[#C9A04C] underline">← Back to content</Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <div><label className="mb-1 block text-xs font-semibold text-gray-600">From path</label>
          <input dir="ltr" className="rounded-lg border p-2 text-sm" placeholder="/old-page" value={fromPath} onChange={(e) => setFromPath(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-gray-600">To path</label>
          <input dir="ltr" className="rounded-lg border p-2 text-sm" placeholder="/uae-visa" value={toPath} onChange={(e) => setToPath(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs font-semibold text-gray-600">Code</label>
          <select className="rounded-lg border p-2 text-sm" value={statusCode} onChange={(e) => setStatusCode(e.target.value as '301' | '302')}>
            <option value="301">301 (permanent)</option><option value="302">302 (temporary)</option>
          </select></div>
        <button onClick={submit} disabled={createMut.isPending} className="rounded-lg bg-[#C9A04C] px-4 py-2 text-sm font-bold text-[#0A1628] disabled:opacity-50">
          Add redirect
        </button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b text-left text-gray-500"><th className="p-2">From</th><th className="p-2">To</th><th className="p-2">Code</th><th className="p-2">Active</th><th className="p-2"></th></tr></thead>
        <tbody>
          {query.data?.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2 font-mono text-xs">{r.fromPath}</td>
              <td className="p-2 font-mono text-xs">{r.toPath}</td>
              <td className="p-2">{r.statusCode}</td>
              <td className="p-2">{r.isActive === 1 ? '✓' : '—'}</td>
              <td className="p-2">
                {r.isActive === 1 && (
                  <button onClick={() => deactivateMut.mutate({ id: r.id })} className="text-xs text-red-600 underline">Deactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
