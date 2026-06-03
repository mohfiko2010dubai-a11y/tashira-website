import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import { ViewInvoiceButton } from '@/components/shared/InvoiceButton';
import * as XLSX from 'xlsx';
import {
  Search, Eye, LogOut, Filter, RefreshCw, Building2,
  Download, Calendar, DollarSign, Users, TrendingUp, UserCircle,
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

export default function AdminApplications() {
  const { logout } = useAdminAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assigningSupplier, setAssigningSupplier] = useState<string | null>(null);
  const [supplierCostInput, setSupplierCostInput] = useState('');

  const { data: applications, isLoading, refetch } = trpc.application.list.useQuery({
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  const { data: suppliersList } = trpc.supplier.list.useQuery();
  const { data: analytics } = trpc.application.analytics.useQuery();

  const assignSupplierMut = trpc.application.assignSupplier.useMutation({
    onSuccess: () => { utils.application.list.invalidate(); setAssigningSupplier(null); setSupplierCostInput(''); },
  });

  const sorted = [...(applications || [])].sort((a: any, b: any) => {
    return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
  });

  const filtered = sorted.filter((app: any) => {
    const q = search.toLowerCase();
    return (
      app.referenceNumber.toLowerCase().includes(q) ||
      app.contactEmail.toLowerCase().includes(q) ||
      (app.applicants?.[0]?.fullName || '').toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    const data = filtered.map((app: any) => {
      const applicant = app.applicants?.[0] || {};
      const cost = Number(app.supplierCost || 0);
      const revenue = Number(app.totalAmount || 0);
      const profit = revenue - cost;
      const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
      return {
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Name': applicant.fullName || '-',
        'Email': app.contactEmail,
        'Phone': app.contactPhone,
        'Nationality': applicant.nationality || '-',
        'Visa Type': app.visaType,
        'Processing': app.processingType,
        'Base Type': app.baseType,
        'Applicants': app.applicants?.length || 1,
        'Status': app.status,
        'Payment': app.paymentStatus,
        'Total Amount': revenue,
        'Supplier': app.supplier?.name || '-',
        'Supplier Cost': cost,
        'Profit': profit,
        'Margin %': margin + '%',
        'Stripe PI': app.stripePaymentIntentId || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    XLSX.writeFile(wb, `tashira-applications-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleAssignSupplier = (appId: number, supplierId: number) => {
    const cost = parseFloat(supplierCostInput);
    assignSupplierMut.mutate({ id: appId, supplierId, supplierCost: isNaN(cost) ? 0 : cost });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><h1 className="text-lg font-bold">TASHIRA Admin</h1></div>
        <div className="flex items-center gap-3">
          <Link to="/admin/suppliers" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Building2 size={14} /> Suppliers
          </Link>
          <Link to="/admin/staff" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <UserCircle size={14} /> Staff
          </Link>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Total</p></div>
            <p className="text-2xl font-bold text-[#C9A04C]">{analytics?.totalApplications || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">Revenue</p></div>
            <p className="text-2xl font-bold text-emerald-600">${(analytics?.totalRevenue || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-red-400" /><p className="text-xs text-gray-500">Costs</p></div>
            <p className="text-2xl font-bold text-red-500">${(analytics?.totalCosts || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-purple-500" /><p className="text-xs text-gray-500">Profit</p></div>
            <p className="text-2xl font-bold text-purple-600">${(analytics?.profit || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-blue-500" /><p className="text-xs text-gray-500">Paid</p></div>
            <p className="text-2xl font-bold text-blue-600">{analytics?.paidApplications || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, email, name..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
            <div className="relative min-w-[140px]">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white w-full">
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option><option value="payment_received">Payment Received</option>
                <option value="documents_pending">Docs Pending</option><option value="documents_received">Docs Received</option>
                <option value="under_review">Under Review</option><option value="visa_processing">Visa Processing</option>
                <option value="visa_received">Visa Received</option><option value="completed">Completed</option>
                <option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <span className="text-gray-400">-</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:shadow-md transition-all">
              <Download size={14} /> Export Excel
            </button>
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
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Supplier</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Cost</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Profit</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((app: any) => {
                    const cost = Number(app.supplierCost || 0);
                    const revenue = Number(app.totalAmount || 0);
                    const profit = revenue - cost;
                    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(0) : '0';
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[#C9A04C] font-semibold">{app.referenceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">{app.applicants?.[0]?.fullName || '-'}</td>
                        <td className="px-3 py-2">{app.visaType}<br/><span className="text-gray-400">{app.processingType}</span></td>
                        <td className="px-3 py-2 text-center">{app.applicants?.length || 1}</td>
                        <td className="px-3 py-2 font-semibold">${revenue.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          {app.supplier ? (
                            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{app.supplier.name}</span>
                          ) : (
                            <select
                              value=""
                              onChange={e => {
                                if (e.target.value) {
                                  setAssigningSupplier(app.id + '-' + e.target.value);
                                }
                              }}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:border-[#C9A04C] focus:outline-none"
                            >
                              <option value="">Assign...</option>
                              {(suppliersList || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                          {assigningSupplier === app.id + '-' + (app.supplierId || '') && (
                            <div className="mt-1 flex gap-1">
                              <input type="number" placeholder="Cost" value={supplierCostInput} onChange={e => setSupplierCostInput(e.target.value)} className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5" />
                              <button onClick={() => { const parts = assigningSupplier.split('-'); handleAssignSupplier(app.id, parseInt(parts[1])); }} className="text-xs bg-[#C9A04C] text-white px-2 py-0.5 rounded">OK</button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-red-500">${cost.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            ${profit.toFixed(2)} ({margin}%)
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[app.status] || ''}`}>{app.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Link to={`/admin/applications/${app.referenceNumber}`} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Eye size={14} /></Link>
                            {app.invoiceNumber && <ViewInvoiceButton invoiceNumber={app.invoiceNumber} referenceNumber={app.referenceNumber} totalAmount={revenue} customerEmail={app.contactEmail} customerPhone={app.contactPhone} visaType={app.visaType} processingType={app.processingType} />}
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
