import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import {
  Search, FileText, Eye, LogOut, Filter, Download,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  payment_received: 'bg-emerald-100 text-emerald-700',
  documents_pending: 'bg-amber-100 text-amber-700',
  documents_received: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  visa_processing: 'bg-cyan-100 text-cyan-700',
  visa_received: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function AdminApplications() {
  const { logout } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: applications, isLoading } = trpc.application.list.useQuery({
    status: statusFilter || undefined,
    limit: 100,
  });

  const filtered = (applications || []).filter((app) => {
    const q = search.toLowerCase();
    return (
      app.referenceNumber.toLowerCase().includes(q) ||
      app.contactEmail.toLowerCase().includes(q) ||
      (app.applicants?.[0]?.fullName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">TASHIRA Admin</h1>
          <span className="text-xs text-gray-400">Applications</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, email, or name..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:outline-none"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="payment_received">Payment Received</option>
              <option value="documents_pending">Documents Pending</option>
              <option value="documents_received">Documents Received</option>
              <option value="under_review">Under Review</option>
              <option value="visa_processing">Visa Processing</option>
              <option value="visa_received">Visa Received</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <p className="text-2xl font-bold text-[#C9A04C]">{filtered.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <p className="text-2xl font-bold text-emerald-600">
              {filtered.filter((a) => a.paymentStatus === 'paid').length}
            </p>
            <p className="text-xs text-gray-500">Paid</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <p className="text-2xl font-bold text-amber-600">
              {filtered.filter((a) => a.paymentStatus === 'pending').length}
            </p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-800">
              ${filtered.reduce((s, a) => s + Number(a.totalAmount), 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Revenue</p>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Ref #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Visa</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-[#C9A04C] font-semibold">
                        {app.referenceNumber}
                      </td>
                      <td className="px-4 py-3">
                        {app.applicants?.[0]?.fullName || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{app.contactEmail}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{app.visaType}</span>
                        <span className="text-xs text-gray-400 ml-1">({app.processingType})</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">${app.totalAmount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[app.paymentStatus] || ''}`}>
                          {app.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || ''}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            to={`/admin/applications/${app.referenceNumber}`}
                            className="p-1.5 text-gray-400 hover:text-[#C9A04C] transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </Link>
                          {app.invoiceNumber && (
                            <a
                              href={`/api/invoices/${app.invoiceNumber}/download`}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                              title="Download Invoice"
                            >
                              <FileText size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No applications found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
