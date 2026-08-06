import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc-client';
import * as XLSX from 'xlsx';
import type { ApplicationWithLegacyAmount } from '@/types/trpc';
import {
  ArrowLeft, Search, Download, Calendar, LogOut,
  DollarSign, Receipt, FileText, TrendingUp,
} from 'lucide-react';

const VAT_LABELS: Record<string, string> = {
  standard: '5%',
  zero_rated: '0%',
  exempt: 'Exempt',
  out_of_scope: 'Out of Scope',
};

export default function AdminSupplierDashboard() {
  const { logout } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  const { data: applications, isLoading } = trpc.application.list.useQuery({
    status: undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  const { data: suppliersList } = trpc.supplier.list.useQuery();

  // Filter applications with supplier costs
  const supplierBills = (applications || []).filter((app) => {
    const a: ApplicationWithLegacyAmount = app;
    const hasSupplier = a.supplierId || app.supplier;
    const q = search.toLowerCase();
    const matchesSearch = app.referenceNumber.toLowerCase().includes(q) ||
      (app.supplier?.name || '').toLowerCase().includes(q);
    const matchesSupplier = !supplierFilter || String(a.supplierId) === supplierFilter;
    return hasSupplier && matchesSearch && matchesSupplier;
  });

  // Summary
  const totalCostAed = supplierBills.reduce((sum, app) => sum + Number(app.supplierCostAed || 0), 0);
  const totalVatAed = supplierBills.reduce((sum, app) => sum + Number(app.supplierVatAmount || 0), 0);
  const pendingCount = supplierBills.filter((app) => app.supplierPaid === 'pending').length;

  const handleExportExcel = () => {
    const data = supplierBills.map((app) => {
      const a: ApplicationWithLegacyAmount = app;
      return {
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Supplier': app.supplier?.name || '-',
        'Supplier Inv #': a.supplierInvoiceNumber || '-',
        'Cost (AED)': Number(a.supplierCostAed || 0).toFixed(2),
        'VAT Status': a.supplierVatStatus || '-',
        'VAT Amount': Number(a.supplierVatAmount || 0).toFixed(2),
        'Total (AED)': Number(a.supplierTotalAed || a.supplierCostAed || 0).toFixed(2),
        'Payment Status': a.supplierPaid || 'pending',
        'Place of Supply': a.supplierPlaceOfSupply || '-',
        'Notes': a.supplierNotes || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Bills');
    XLSX.writeFile(wb, `tashira-supplier-bills-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold">Supplier Bills & Purchase Orders</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"><LogOut size={14} /> Logout</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Receipt size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Bills</p></div>
            <p className="text-2xl font-bold text-[#C9A04C]">{supplierBills.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-red-400" /><p className="text-xs text-gray-500">Total Cost</p></div>
            <p className="text-2xl font-bold text-red-500">AED {totalCostAed.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-purple-500" /><p className="text-xs text-gray-500">VAT Paid</p></div>
            <p className="text-2xl font-bold text-purple-600">AED {totalVatAed.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><FileText size={14} className="text-amber-500" /><p className="text-xs text-gray-500">Pending Payment</p></div>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ref, supplier..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
            </div>
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white min-w-[160px]">
              <option value="">All Suppliers</option>
              {(suppliersList || []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
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
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Ref #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Supplier</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Supplier Inv #</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Cost (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">VAT</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Total (AED)</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Place of Supply</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Paid?</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {supplierBills.map((app) => {
                    const a: ApplicationWithLegacyAmount = app;
                    const costAed = Number(a.supplierCostAed || 0);
                    const totalAed = Number(a.supplierTotalAed || costAed);
                    const vatLabel = VAT_LABELS[a.supplierVatStatus || ''] || '-';
                    const isPaid = a.supplierPaid === 'paid';
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[#C9A04C] font-semibold">{app.referenceNumber}</td>
                        <td className="px-3 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2"><span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{app.supplier?.name || '-'}</span></td>
                        <td className="px-3 py-2 font-mono text-gray-500">{a.supplierInvoiceNumber || '-'}</td>
                        <td className="px-3 py-2 text-red-500">AED {costAed.toFixed(2)}</td>
                        <td className="px-3 py-2"><span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{vatLabel}</span></td>
                        <td className="px-3 py-2 font-semibold">AED {totalAed.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{(a.supplierPlaceOfSupply || '').replace('_', ' ') || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {a.supplierPaid || 'pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{a.supplierNotes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {supplierBills.length === 0 && <div className="text-center py-12 text-gray-400">No supplier bills found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
