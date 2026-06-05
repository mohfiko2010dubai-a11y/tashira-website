import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import { ViewInvoiceButton } from '@/components/shared/InvoiceButton';
import SupplierCostModal from '@/components/shared/SupplierCostModal';
import * as XLSX from 'xlsx';
import {
  Search, Eye, LogOut, Filter, RefreshCw, Building2,
  Download, Calendar, DollarSign, Users, TrendingUp, UserCircle, Edit3,
  FileText, Receipt, Percent,
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
  const [costModalApp, setCostModalApp] = useState<number | null>(null);

  const { data: applications, isLoading, refetch } = trpc.application.list.useQuery({
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  const { data: analytics } = trpc.application.analytics.useQuery();

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
      const a = app as any;
      const exchangeRate = Number(a.exchangeRate || 3.6725);
      const totalAed = Number(a.totalAmountAed || a.totalAmount || 0);
      const totalUsd = Number(a.totalAmountUsd || a.stripeAmountUsd || totalAed / exchangeRate);
      const costAed = Number(a.supplierCostAed || 0);
      const profitAed = totalAed - costAed;
      return {
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Name': app.applicants?.[0]?.fullName || '-',
        'Email': app.contactEmail,
        'Visa Type': app.visaType,
        'Processing': app.processingType,
        'Base Type': app.baseType,
        'Applicants': app.applicants?.length || 1,
        'Invoice Price (USD)': totalUsd.toFixed(2),
        'Exchange Rate': exchangeRate,
        'Amount (AED)': totalAed.toFixed(2),
        'Status': app.status,
        'Payment': app.paymentStatus,
        'Supplier': app.supplier?.name || '-',
        'Supplier Cost (AED)': costAed,
        'Supplier VAT': a.supplierVatStatus || '-',
        'Supplier Total (AED)': Number(a.supplierTotalAed || costAed),
        'Profit (AED)': profitAed.toFixed(2),
        'Margin %': totalAed > 0 ? ((profitAed / totalAed) * 100).toFixed(1) + '%' : '0%',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    XLSX.writeFile(wb, `tashira-applications-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><h1 className="text-lg font-bold">TASHIRA Admin</h1></div>
        <div className="flex items-center gap-3">
          <Link to="/admin/invoices" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Receipt size={14} /> Customer Invoices
          </Link>
          <Link to="/admin/supplier-dashboard" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Building2 size={14} /> Supplier Bills
          </Link>
          <Link to="/admin/vat" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Percent size={14} /> VAT
          </Link>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Users size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Total</p></div>
            <p className="text-xl font-bold text-[#C9A04C]">{analytics?.totalApplications || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">Revenue (AED)</p></div>
            <p className="text-xl font-bold text-emerald-600">AED {(analytics?.totalRevenueAed || 0).toLocaleString('en-AE', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-blue-500" /><p className="text-xs text-gray-500">Revenue (USD)</p></div>
            <p className="text-xl font-bold text-blue-600">${(analytics?.totalRevenueUsd || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-red-400" /><p className="text-xs text-gray-500">Costs (AED)</p></div>
            <p className="text-xl font-bold text-red-500">AED {(analytics?.totalCostsAed || 0).toLocaleString('en-AE', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-purple-500" /><p className="text-xs text-gray-500">Profit (AED)</p></div>
            <p className="text-xl font-bold text-purple-600">AED {(analytics?.profitAed || 0).toLocaleString('en-AE', {minimumFractionDigits: 2})}</p>
            <p className="text-xs text-gray-400">{analytics?.profitMargin || 0}% margin</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-indigo-500" /><p className="text-xs text-gray-500">Profit (USD)</p></div>
            <p className="text-xl font-bold text-indigo-600">${(analytics?.profitUsd || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
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
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Invoice Price (USD)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Rate</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Amount (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Supplier</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Cost (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Profit (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((app: any) => {
                    const a = app as any;
                    const exchangeRate = Number(a.exchangeRate || 3.6725);
                    const totalAed = Number(a.totalAmountAed || a.totalAmount || 0);
                    const totalUsd = Number(a.totalAmountUsd || a.stripeAmountUsd || totalAed / exchangeRate);
                    const costAed = Number(a.supplierCostAed || 0);
                    const profitAed = totalAed - costAed;
                    const margin = totalAed > 0 ? ((profitAed / totalAed) * 100).toFixed(0) : '0';
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[#C9A04C] font-semibold">{app.referenceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">{app.applicants?.[0]?.fullName || '-'}</td>
                        <td className="px-3 py-2">{app.visaType}<br/><span className="text-gray-400">{app.processingType}</span></td>
                        <td className="px-3 py-2 text-center">{app.applicants?.length || 1}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">${totalUsd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-500">{exchangeRate}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-600">AED {totalAed.toLocaleString('en-AE', {minimumFractionDigits: 2})}</td>
                        <td className="px-3 py-2">
                          {app.supplier ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{app.supplier.name}</span>
                              <button onClick={() => setCostModalApp(app.id)} className="text-gray-400 hover:text-[#C9A04C]">
                                <Edit3 size={10} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setCostModalApp(app.id)} className="text-xs text-[#C9A04C] hover:underline">+ Add Cost</button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-red-500">{costAed > 0 ? `AED ${costAed.toFixed(2)}` : '-'}</td>
                        <td className="px-3 py-2">
                          <span className={profitAed >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                            AED {profitAed.toFixed(2)} ({margin}%)
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[app.status] || ''}`}>{app.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Link to={`/admin/applications/${app.referenceNumber}`} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Eye size={14} /></Link>
                            {app.invoiceNumber && <ViewInvoiceButton invoiceNumber={app.invoiceNumber} referenceNumber={app.referenceNumber} totalAmountUsd={totalUsd} exchangeRate={exchangeRate} customerEmail={app.contactEmail} customerPhone={app.contactPhone} visaType={app.visaType} processingType={app.processingType} />}
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

      {costModalApp && (
        <SupplierCostModal applicationId={costModalApp} onClose={() => setCostModalApp(null)} onSaved={() => {}} />
      )}
    </div>
  );
}
