import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import { FileCheck, DollarSign, Search, Filter, Eye, CheckCircle, XCircle, Users } from 'lucide-react';

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: analytics } = trpc.application.analytics.useQuery();
  const { data: applications } = trpc.application.list.useQuery({ limit: 50, offset: 0 });

  const updateStatus = trpc.application.updateStatus.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  const filteredApps = applications?.filter((app) => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        app.referenceNumber.toLowerCase().includes(s) ||
        app.contactEmail.toLowerCase().includes(s) ||
        app.visaType.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    visa_processing: 'bg-emerald-100 text-emerald-700',
    visa_received: 'bg-purple-100 text-purple-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    visa_processing: 'Visa Processing',
    visa_received: 'Visa Received',
    rejected: 'Rejected',
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Tashira Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{analytics?.totalApplications || 0}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileCheck size={20} className="text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Paid</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{analytics?.paidApplications || 0}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <CheckCircle size={20} className="text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Family Applications</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{analytics?.familyCount || 0}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-[#C9A04C] mt-1">${analytics?.totalRevenueUsd?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-10 h-10 bg-[#C9A04C]/10 rounded-lg flex items-center justify-center">
                <DollarSign size={20} className="text-[#C9A04C]" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, email, visa type..."
              className="flex-1 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#C9A04C]"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="visa_processing">Visa Processing</option>
              <option value="visa_received">Visa Received</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Visa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredApps?.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-[#C9A04C]">{app.referenceNumber}</td>
                    <td className="px-4 py-3 capitalize">{app.baseType} / {app.residenceType}</td>
                    <td className="px-4 py-3">{app.visaType}</td>
                    <td className="px-4 py-3 text-gray-500">{app.contactEmail}</td>
                    <td className="px-4 py-3 font-medium">${app.totalAmountUsd}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[app.status] || app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(app.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {app.status === 'submitted' && (
                          <button
                            onClick={() => updateStatus.mutate({ id: app.id, status: 'under_review' })}
                            className="p-1 hover:bg-yellow-100 rounded transition-colors"
                            title="Start Review"
                          >
                            <Eye size={14} className="text-yellow-600" />
                          </button>
                        )}
                        {app.status === 'under_review' && (
                          <button
                            onClick={() => updateStatus.mutate({ id: app.id, status: 'visa_processing' })}
                            className="p-1 hover:bg-emerald-100 rounded transition-colors"
                            title="Approve"
                          >
                            <CheckCircle size={14} className="text-emerald-600" />
                          </button>
                        )}
                        {app.status === 'visa_processing' && (
                          <button
                            onClick={() => updateStatus.mutate({ id: app.id, status: 'visa_received' })}
                            className="p-1 hover:bg-purple-100 rounded transition-colors"
                            title="Issue Visa"
                          >
                            <FileCheck size={14} className="text-purple-600" />
                          </button>
                        )}
                        {(app.status === 'submitted' || app.status === 'under_review') && (
                          <button
                            onClick={() => updateStatus.mutate({ id: app.id, status: 'rejected' })}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Reject"
                          >
                            <XCircle size={14} className="text-red-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!filteredApps || filteredApps.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                      No applications found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
