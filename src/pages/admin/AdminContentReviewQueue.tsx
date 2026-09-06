import { Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';

/** News items whose verification is older than 90 days (or missing) — must be re-verified to stay published. */
export default function AdminContentReviewQueue() {
  const query = trpc.content.reviewQueue.useQuery();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0A1628]">News verification queue</h1>
        <Link to="/admin/content" className="text-sm text-[#C9A04C] underline">← Back to content</Link>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Published news older than 90 days since last verification (or never verified). Re-verify the source and update
        the "last verified" date, or unpublish the item.
      </p>
      {query.isLoading && <p className="text-gray-500">Loading…</p>}
      {query.error && <p className="text-red-600">{query.error.message}</p>}
      {query.data && query.data.length === 0 && <p className="text-emerald-700">Queue is empty — all published news is verified.</p>}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="p-2">Title</th><th className="p-2">Lang</th><th className="p-2">Source</th><th className="p-2">Last verified</th><th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {query.data?.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-2 font-medium">{item.title}</td>
              <td className="p-2">{item.language}</td>
              <td className="p-2">{item.sourceAuthority ?? '—'}</td>
              <td className="p-2 text-red-600">{item.lastVerifiedAt ? String(item.lastVerifiedAt).slice(0, 10) : 'never'}</td>
              <td className="p-2"><Link to={`/admin/content/${item.id}`} className="text-[#C9A04C] underline">Review</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
