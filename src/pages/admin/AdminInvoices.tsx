import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import { ViewInvoiceButton } from '@/components/shared/InvoiceButton';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Search, Download, Calendar, LogOut, Receipt,
  DollarSign, TrendingUp, Filter,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function AdminInvoices() {
  const { logout } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const { data: applications, isLoading } = trpc.application.list.useQuery({
    status: undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  // Filter only paid applications (these are the invoices)
  const invoices = (applications || []).filter((app: any) => {
    const q = search.toLowerCase();
    const matchesSearch = app.referenceNumber.toLowerCase().includes(q) ||
      app.contactEmail.toLowerCase().includes(q) ||
      (app.applicants?.[0]?.fullName || '').toLowerCase().includes(q);
    const matchesPayment = !paymentFilter || app.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  // Summary
  const totalUsd = invoices.reduce((sum: number, app: any) => {
    const a = app as any;
    const exRate = Number(a.exchangeRate || 3.6725);
    const aed = Number(a.totalAmountAed || a.totalAmount || 0);
    return sum + (Number(a.totalAmountUsd) || aed / exRate);
  }, 0);
  const totalAed = invoices.reduce((sum: number, app: any) => {
    return sum + Number((app as any).totalAmountAed || app.totalAmount || 0);
  }, 0);
  const totalVat = invoices.reduce((sum: number, app: any) => {
    const aed = Number((app as any).totalAmountAed || app.totalAmount || 0);
    return sum + (aed - (aed / 1.05));
  }, 0);

  const handleExportExcel = () => {
    const data = invoices.map((app: any) => {
      const a = app as any;
      const exRate = Number(a.exchangeRate || 3.6725);
      const aed = Number(a.totalAmountAed || a.totalAmount || 0);
      const usd = Number(a.totalAmountUsd) || aed / exRate;
      const subtotal = aed / 1.05;
      const vat = aed - subtotal;
      return {
        'Invoice #': a.invoiceNumber || `INV-${app.referenceNumber}`,
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Customer Name': app.applicants?.[0]?.fullName || '-',
        'Email': app.contactEmail,
        'Phone': app.contactPhone,
        'Visa Type': app.visaType,
        'Processing': app.processingType,
        'Exchange Rate': exRate,
        'Subtotal (AED)': subtotal.toFixed(2),
        'VAT 5% (AED)': vat.toFixed(2),
        'Total (AED)': aed.toFixed(2),
        'Total (USD)': usd.toFixed(2),
        'Payment Status': app.paymentStatus,
        'Stripe PI': a.stripePaymentIntentId || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Invoices');
    XLSX.writeFile(wb, `tashira-customer-invoices-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold">Customer Invoices</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"><LogOut size={14} /> Logout</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Receipt size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Invoices</p></div>
            <p className="text-2xl font-bold text-[#C9A04C]">{invoices.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">Total (AED)</p></div>
            <p className="text-2xl font-bold text-emerald-600">AED {totalAed.toLocaleString('en-AE', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-blue-500" /><p className="text-xs text-gray-500">Total (USD)</p></div>
            <p className="text-2xl font-bold text-blue-600">${totalUsd.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-purple-500" /><p className="text-xs text-gray-500">VAT Collected</p></div>
            <p className="text-2xl font-bold text-purple-600">AED {totalVat.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, email, name..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white min-w-[140px]">
              <option value="">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
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
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Invoice #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Customer</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Visa</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Rate</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Subtotal (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">VAT 5%</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Total (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Total (USD)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((app: any) => {
                    const a = app as any;
                    const exRate = Number(a.exchangeRate || 3.6725);
                    const aed = Number(a.totalAmountAed || a.totalAmount || 0);
                    const usd = Number(a.totalAmountUsd) || aed / exRate;
                    const subtotal = aed / 1.05;
                    const vat = aed - subtotal;
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[#C9A04C] font-semibold">{a.invoiceNumber || `INV-${app.referenceNumber}`}</td>
                        <td className="px-3 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">{app.applicants?.[0]?.fullName || '-'}<br/><span className="text-gray-400">{app.contactEmail}</span></td>
                        <td className="px-3 py-2">{app.visaType}<br/><span className="text-gray-400">{app.processingType}</span></td>
                        <td className="px-3 py-2 text-gray-500">{exRate}</td>
                        <td className="px-3 py-2">AED {subtotal.toFixed(2)}</td>
                        <td className="px-3 py-2 text-purple-600">AED {vat.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-600">AED {aed.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">${usd.toFixed(2)}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[app.paymentStatus] || ''}`}>{app.paymentStatus}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Link to={`/admin/applications/${app.referenceNumber}`} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Receipt size={14} /></Link>
                            {a.invoiceNumber && <ViewInvoiceButton invoiceNumber={a.invoiceNumber} referenceNumber={app.referenceNumber} totalAmountUsd={usd} exchangeRate={exRate} customerEmail={app.contactEmail} customerPhone={app.contactPhone} visaType={app.visaType} processingType={app.processingType} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {invoices.length === 0 && <div className="text-center py-12 text-gray-400">No invoices found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
