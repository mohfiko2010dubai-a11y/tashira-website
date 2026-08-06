import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import * as XLSX from 'xlsx';
import type { ApplicationWithLegacyAmount } from '@/types/trpc';
import {
  ArrowLeft, Download, Calendar, LogOut, Percent,
  DollarSign, TrendingUp, TrendingDown, Receipt, Building2,
} from 'lucide-react';

export default function AdminVat() {
  const { logout } = useAdminAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: applications } = trpc.application.list.useQuery({
    status: undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  });

  // Calculate VAT data
  const customerInvoices = (applications || []).filter((app) => app.paymentStatus === 'paid');
  const supplierBills = (applications || []).filter((app) => app.supplierId || app.supplier);

  // VAT on sales (from customers) - always 5%
  const vatOnSales = customerInvoices.reduce((sum, app) => {
    const a: ApplicationWithLegacyAmount = app;
    const aed = Number(a.totalAmountAed || a.totalAmount || 0);
    const vat = aed - (aed / 1.05);
    return sum + vat;
  }, 0);

  const totalSalesAed = customerInvoices.reduce((sum, app) => {
    const a: ApplicationWithLegacyAmount = app;
    return sum + Number(a.totalAmountAed || a.totalAmount || 0);
  }, 0);

  // VAT on purchases (from suppliers)
  const vatOnPurchases = supplierBills.reduce((sum, app) => {
    return sum + Number(app.supplierVatAmount || 0);
  }, 0);

  const totalPurchasesAed = supplierBills.reduce((sum, app) => {
    return sum + Number(app.supplierTotalAed || app.supplierCostAed || 0);
  }, 0);

  // Net VAT
  const netVat = vatOnSales - vatOnPurchases;

  const handleExportExcel = () => {
    const wsData = [
      { 'Description': 'VAT on Sales (Output)', 'Amount (AED)': vatOnSales.toFixed(2) },
      { 'Description': 'Total Sales (incl. VAT)', 'Amount (AED)': totalSalesAed.toFixed(2) },
      { 'Description': '', 'Amount (AED)': '' },
      { 'Description': 'VAT on Purchases (Input)', 'Amount (AED)': vatOnPurchases.toFixed(2) },
      { 'Description': 'Total Purchases (incl. VAT)', 'Amount (AED)': totalPurchasesAed.toFixed(2) },
      { 'Description': '', 'Amount (AED)': '' },
      { 'Description': netVat >= 0 ? 'VAT Payable' : 'VAT Recoverable', 'Amount (AED)': Math.abs(netVat).toFixed(2) },
    ];

    // Detailed breakdown
    const details = customerInvoices.map((app) => {
      const a: ApplicationWithLegacyAmount = app;
      const aed = Number(a.totalAmountAed || a.totalAmount || 0);
      const subtotal = aed / 1.05;
      const vat = aed - subtotal;
      return {
        'Type': 'Sale',
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Customer': app.applicants?.[0]?.fullName || '-',
        'Subtotal (AED)': subtotal.toFixed(2),
        'VAT 5% (AED)': vat.toFixed(2),
        'Total (AED)': aed.toFixed(2),
      };
    });

    const supplierDetails = supplierBills.map((app) => {
      const a: ApplicationWithLegacyAmount = app;
      const cost = Number(a.supplierCostAed || 0);
      const vat = Number(a.supplierVatAmount || 0);
      const total = Number(a.supplierTotalAed || cost);
      return {
        'Type': 'Purchase',
        'Ref #': app.referenceNumber,
        'Date': app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-',
        'Supplier': app.supplier?.name || '-',
        'Subtotal (AED)': (total - vat).toFixed(2),
        'VAT (AED)': vat.toFixed(2),
        'Total (AED)': total.toFixed(2),
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), 'VAT Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...details, ...supplierDetails]), 'VAT Details');
    XLSX.writeFile(wb, `tashira-vat-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold">VAT Report</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"><LogOut size={14} /> Logout</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Receipt size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">VAT on Sales (5%)</p></div>
            <p className="text-2xl font-bold text-emerald-600">AED {vatOnSales.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Building2 size={14} className="text-red-400" /><p className="text-xs text-gray-500">VAT on Purchases</p></div>
            <p className="text-2xl font-bold text-red-500">AED {vatOnPurchases.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><Percent size={14} className="text-[#C9A04C]" /><p className="text-xs text-gray-500">Net VAT</p></div>
            <p className={`text-2xl font-bold ${netVat >= 0 ? 'text-amber-600' : 'text-purple-600'}`}>
              AED {Math.abs(netVat).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">{netVat >= 0 ? 'Payable' : 'Recoverable'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-blue-500" /><p className="text-xs text-gray-500">Total Sales (AED)</p></div>
            <p className="text-2xl font-bold text-blue-600">AED {totalSalesAed.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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

        {/* VAT Calculation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Output VAT (Sales) */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" /> Output VAT (Sales to Customers)
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Sales (incl. 5% VAT)</span>
                <span className="font-medium">AED {totalSalesAed.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sales (excl. VAT)</span>
                <span className="font-medium">AED {(totalSalesAed / 1.05).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-emerald-600">VAT on Sales (5%)</span>
                <span className="text-emerald-600">AED {vatOnSales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Input VAT (Purchases) */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" /> Input VAT (Supplier Purchases)
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Purchases</span>
                <span className="font-medium">AED {totalPurchasesAed.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Purchases (excl. VAT)</span>
                <span className="font-medium">AED {(totalPurchasesAed - vatOnPurchases).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-red-600">VAT on Purchases</span>
                <span className="text-red-600">AED {vatOnPurchases.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Sales Invoices */}
        <div className="mt-6 bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Receipt size={16} className="text-emerald-500" /> Output VAT - Sales Invoices Detail
            </h2>
            <span className="text-xs text-gray-400">{customerInvoices.length} invoices</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Invoice #</th>
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-left px-4 py-2 font-semibold">Customer</th>
                  <th className="text-right px-4 py-2 font-semibold">Subtotal (AED)</th>
                  <th className="text-right px-4 py-2 font-semibold">VAT 5% (AED)</th>
                  <th className="text-right px-4 py-2 font-semibold">Total (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customerInvoices.map((app) => {
                  const a: ApplicationWithLegacyAmount = app;
                  const aed = Number(a.totalAmountAed || a.totalAmount || 0);
                  const subtotal = aed / 1.05;
                  const vat = aed - subtotal;
                  return (
                    <tr key={app.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono text-[#C9A04C] font-semibold">{a.invoiceNumber || `INV-${app.referenceNumber}`}</td>
                      <td className="px-4 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2">{app.applicants?.[0]?.fullName || '-'}<br/><span className="text-gray-400 text-xs">{app.contactEmail}</span></td>
                      <td className="px-4 py-2 text-right">AED {subtotal.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-purple-600">AED {vat.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-emerald-600">AED {aed.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {customerInvoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No sales invoices found.</td></tr>
                )}
              </tbody>
              {customerInvoices.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold text-gray-700">
                  <tr>
                    <td className="px-4 py-2" colSpan={3}>Total</td>
                    <td className="px-4 py-2 text-right">AED {(totalSalesAed / 1.05).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-purple-600">AED {vatOnSales.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">AED {totalSalesAed.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Detailed Purchase Invoices */}
        <div className="mt-6 bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 size={16} className="text-red-400" /> Input VAT - Supplier Purchase Invoices Detail
            </h2>
            <span className="text-xs text-gray-400">{supplierBills.length} bills</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Ref #</th>
                  <th className="text-left px-4 py-2 font-semibold">Date</th>
                  <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                  <th className="text-left px-4 py-2 font-semibold">VAT Status</th>
                  <th className="text-right px-4 py-2 font-semibold">Cost (AED)</th>
                  <th className="text-right px-4 py-2 font-semibold">VAT (AED)</th>
                  <th className="text-right px-4 py-2 font-semibold">Total (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {supplierBills.map((app) => {
                  const a: ApplicationWithLegacyAmount = app;
                  const cost = Number(a.supplierCostAed || 0);
                  const vat = Number(a.supplierVatAmount || 0);
                  const total = Number(a.supplierTotalAed || cost + vat);
                  return (
                    <tr key={app.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono text-[#C9A04C] font-semibold">{app.referenceNumber}</td>
                      <td className="px-4 py-2 text-gray-500">{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-2">{app.supplier?.name || a.supplierName || '-'}</td>
                      <td className="px-4 py-2"><span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{a.supplierVatStatus || '-'}</span></td>
                      <td className="px-4 py-2 text-right">AED {cost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-purple-600">AED {vat.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-500">AED {total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {supplierBills.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No supplier bills found.</td></tr>
                )}
              </tbody>
              {supplierBills.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold text-gray-700">
                  <tr>
                    <td className="px-4 py-2" colSpan={4}>Total</td>
                    <td className="px-4 py-2 text-right">AED {(totalPurchasesAed - vatOnPurchases).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-purple-600">AED {vatOnPurchases.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-red-500">AED {totalPurchasesAed.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Net VAT */}
        <div className={`mt-6 rounded-lg p-5 ${netVat >= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-purple-50 border border-purple-200'}`}>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Percent size={20} className={netVat >= 0 ? 'text-amber-600' : 'text-purple-600'} />
            {netVat >= 0 ? 'VAT Payable to FTA' : 'VAT Recoverable from FTA'}
          </h2>
          <p className={`text-3xl font-bold ${netVat >= 0 ? 'text-amber-600' : 'text-purple-600'}`}>
            AED {Math.abs(netVat).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {netVat >= 0
              ? 'You need to pay this amount to the Federal Tax Authority'
              : 'You can claim this amount back from the Federal Tax Authority'}
          </p>
        </div>
      </div>
    </div>
  );
}
