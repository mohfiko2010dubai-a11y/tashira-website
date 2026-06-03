import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc';
import {
  ArrowLeft, FileText, Download, RefreshCw, Receipt, Building2, DollarSign,
} from 'lucide-react';
import { ViewInvoiceButton, DownloadInvoiceButton } from '@/components/shared/InvoiceButton';
import { generateInvoicePDF } from '@/components/shared/InvoiceGenerator';

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

export default function AdminApplicationDetail() {
  const { referenceNumber } = useParams<{ referenceNumber: string }>();
  const [statusValue, setStatusValue] = useState('');

  const utils = trpc.useUtils();
  const { data: app, isLoading } = trpc.application.getByReference.useQuery(
    { referenceNumber: referenceNumber || '' },
    { enabled: !!referenceNumber }
  );

  const updateStatus = trpc.application.updateStatus.useMutation({
    onSuccess: () => {
      utils.application.getByReference.invalidate();
      utils.application.list.invalidate();
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (!app || !newStatus) return;
    updateStatus.mutate({ id: app.id, status: newStatus as any });
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Application not found</p>
          <Link to="/admin/applications" className="text-[#C9A04C] hover:underline">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  const mainApplicant = app.applicants?.[0];

  // Generate invoice on the fly
  const handleGenerateInvoice = () => {
    const invoiceNumber = app.invoiceNumber || `INV-${app.referenceNumber}`;
    const doc = generateInvoicePDF({
      invoiceNumber,
      referenceNumber: app.referenceNumber,
      createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : new Date().toISOString(),
      customerName: mainApplicant?.fullName || app.contactEmail?.split('@')[0] || 'Customer',
      customerEmail: app.contactEmail || '',
      customerPhone: app.contactPhone || '',
      passportNumber: mainApplicant?.passportNumber || undefined,
      nationality: mainApplicant?.nationality || undefined,
      visaType: app.visaType || '',
      processingType: app.processingType || '',
      arrivalDate: app.arrivalDate || undefined,
      totalAmount: Number(app.totalAmount) || 0,
      stripePaymentIntentId: app.stripePaymentIntentId || undefined,
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/applications" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Application Details</h1>
          <p className="text-xs text-gray-400 font-mono">{app.referenceNumber}</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Status Bar */}
        <div className="bg-white rounded-lg border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[app.status] || ''}`}>
              {app.status}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              app.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
              app.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {app.paymentStatus}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={statusValue || app.status}
              onChange={(e) => { setStatusValue(e.target.value); handleStatusChange(e.target.value); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none"
            >
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
            {updateStatus.isPending && <RefreshCw size={14} className="animate-spin text-[#C9A04C]" />}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Details */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Customer Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Full Name</span>
                <span className="font-medium">{mainApplicant?.fullName || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Email</span>
                <span>{app.contactEmail}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Phone</span>
                <span>{app.contactPhone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Nationality</span>
                <span>{mainApplicant?.nationality || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Passport</span>
                <span className="font-mono">{mainApplicant?.passportNumber || '-'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Profession</span>
                <span>{mainApplicant?.profession || '-'}</span>
              </div>
            </div>
          </div>

          {/* Application Details */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Application Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Reference #</span>
                <span className="font-mono font-semibold text-[#C9A04C]">{app.referenceNumber}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Visa Type</span>
                <span>{app.visaType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Processing</span>
                <span>{app.processingType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Base Type</span>
                <span>{app.baseType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Residence</span>
                <span>{app.residenceType}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Arrival Date</span>
                <span>{app.arrivalDate || '-'}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Payment Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-bold text-lg text-[#C9A04C]">${app.totalAmount}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Payment Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  app.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  app.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{app.paymentStatus}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Stripe PI</span>
                <span className="font-mono text-xs">{app.stripePaymentIntentId || '-'}</span>
              </div>
            </div>
          </div>

          {/* Invoice */}
          <div className="bg-white rounded-lg border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Invoice</h2>
            <div className="space-y-3">
              <p className="text-sm">
                <span className="text-gray-500">Invoice #:</span>{' '}
                <span className="font-mono font-semibold">{app.invoiceNumber || `INV-${app.referenceNumber}`}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleGenerateInvoice}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm rounded-lg hover:shadow-md transition-all"
                >
                  <Receipt size={14} />
                  Generate Invoice
                </button>
                {app.invoiceNumber && (
                  <>
                    <ViewInvoiceButton
                      invoiceNumber={app.invoiceNumber}
                      referenceNumber={app.referenceNumber}
                      totalAmount={Number(app.totalAmount)}
                      customerEmail={app.contactEmail}
                      customerPhone={app.contactPhone}
                      visaType={app.visaType}
                      processingType={app.processingType}
                    />
                    <DownloadInvoiceButton
                      invoiceNumber={app.invoiceNumber}
                      referenceNumber={app.referenceNumber}
                      totalAmount={Number(app.totalAmount)}
                      customerEmail={app.contactEmail}
                      customerPhone={app.contactPhone}
                      visaType={app.visaType}
                      processingType={app.processingType}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Supplier & Profit */}
          <div className="bg-white rounded-lg border border-gray-100 p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
              <Building2 size={14} /> Supplier & Profit
            </h2>
            {app.supplier ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Supplier</p>
                  <p className="text-sm font-semibold">{app.supplier.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="text-sm">{app.supplier.contactPerson || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cost</p>
                  <p className="text-sm font-semibold text-red-500">${Number(app.supplierCost || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profit Margin</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    ${(Number(app.totalAmount || 0) - Number(app.supplierCost || 0)).toFixed(2)}
                    ({Number(app.totalAmount || 0) > 0 ? (((Number(app.totalAmount || 0) - Number(app.supplierCost || 0)) / Number(app.totalAmount || 0)) * 100).toFixed(0) : '0'}%)
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 text-sm mb-3">No supplier assigned.</p>
              </div>
            )}
          </div>

          {/* Documents Placeholder */}
          <div className="bg-white rounded-lg border border-gray-100 p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Documents</h2>
            <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-sm">Document upload coming soon.</p>
              <p className="text-gray-300 text-xs mt-1">Passport, Photo, Residence ID will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
