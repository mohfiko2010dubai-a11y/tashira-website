import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { trpc } from '@/providers/trpc-client';
import { ViewInvoiceButton } from '@/components/shared/InvoiceButton';
import {
  Search, Eye, LogOut, RefreshCw, Calendar, DollarSign,
  Users, FileText,
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

export default function StaffDashboard() {
  const { logout, staff } = useStaffAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'submitted' | 'payment_received' | 'documents_pending' | 'documents_received' | 'under_review' | 'visa_processing' | 'visa_received' | 'completed' | 'rejected' | 'cancelled'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: applications, isLoading, refetch } = trpc.application.list.useQuery({
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  const sorted = [...(applications || [])].sort((a, b) => {
    return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
  });

  const filtered = sorted.filter((app) => {
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
          <h1 className="text-lg font-bold">TASHIRA Staff</h1>
          {staff && (
            <span className="text-xs bg-[#C9A04C]/20 text-[#C9A04C] px-2 py-0.5 rounded-full">
              {staff.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Total Applications</p></div>
            <p className="text-2xl font-bold text-[#C9A04C]">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">Total Revenue</p></div>
            <p className="text-2xl font-bold text-emerald-600">
              ${filtered.reduce((sum, app) => sum + Number(app.totalAmountUsd || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><FileText size={14} className="text-blue-500" /><p className="text-xs text-gray-500">Paid</p></div>
            <p className="text-2xl font-bold text-blue-600">
              {filtered.filter((app) => app.paymentStatus === 'paid').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-purple-500" /><p className="text-xs text-gray-500">Pending</p></div>
            <p className="text-2xl font-bold text-purple-600">
              {filtered.filter((app) => app.paymentStatus === 'pending').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, email, name..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white min-w-[140px]">
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option><option value="payment_received">Payment Received</option>
              <option value="documents_pending">Docs Pending</option><option value="documents_received">Docs Received</option>
              <option value="under_review">Under Review</option><option value="visa_processing">Visa Processing</option>
              <option value="visa_received">Visa Received</option><option value="completed">Completed</option>
              <option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
            </select>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <span className="text-gray-400">-</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Ref #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Visa</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Qty</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((app) => {
                    const revenue = Number(app.totalAmountUsd || 0);
                    const exchangeRate = Number(app.exchangeRate || 0);
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[#C9A04C] font-semibold">{app.referenceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">{app.applicants?.[0]?.fullName || '-'}</td>
                        <td className="px-3 py-2">{app.visaType}<br/><span className="text-gray-400">{app.processingType}</span></td>
                        <td className="px-3 py-2 text-center">{app.applicants?.length || 1}</td>
                        <td className="px-3 py-2 font-semibold">${revenue.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[app.status] || ''}`}>{app.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Link to={`/staff/applications/${app.referenceNumber}`} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Eye size={14} /></Link>
                            {app.invoiceNumber && (
                              <ViewInvoiceButton
                                invoiceNumber={app.invoiceNumber}
                                referenceNumber={app.referenceNumber}
                                totalAmountUsd={revenue} exchangeRate={exchangeRate}
                                customerEmail={app.contactEmail}
                                customerPhone={app.contactPhone}
                                visaType={app.visaType}
                                processingType={app.processingType}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="text-center py-12 text-gray-400">No applications found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
