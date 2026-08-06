import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import {
  ArrowLeft, Receipt, Building2, RefreshCw,
  Users, DollarSign, ClipboardList, StickyNote, FolderOpen,
} from "lucide-react";
import { ViewInvoiceButton, DownloadInvoiceButton } from "@/components/shared/InvoiceButton";
import { generateInvoicePDF } from "@/components/shared/InvoiceGenerator";
import DocumentManager from "@/components/shared/DocumentManager";
import type { ApplicationWithLegacyAmount } from "@/types/trpc";

const statusColors: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-700",
  payment_received: "bg-emerald-100 text-emerald-700",
  documents_pending: "bg-amber-100 text-amber-700",
  documents_received: "bg-blue-100 text-blue-700",
  under_review: "bg-purple-100 text-purple-700",
  visa_processing: "bg-cyan-100 text-cyan-700",
  visa_received: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500",
};

const TABS = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "applicants", label: "Applicants", icon: Users },
  { key: "payments", label: "Payments", icon: DollarSign },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "notes", label: "Notes", icon: StickyNote },
];

export default function AdminApplicationDetail() {
  const { referenceNumber } = useParams<{ referenceNumber: string }>();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && TABS.some((t) => t.key === tab) ? tab : "overview";
  });
  const [statusValue, setStatusValue] = useState("");

  const utils = trpc.useUtils();
  const { data: app, isLoading } = trpc.application.getByReference.useQuery(
    { referenceNumber: referenceNumber || "" },
    { enabled: !!referenceNumber },
  );

  const { data: docCount } = trpc.document.countByApplication.useQuery(
    { applicationId: app?.id || 0 },
    { enabled: !!app?.id },
  );

  const updateStatus = trpc.application.updateStatus.useMutation({
    onSuccess: () => {
      utils.application.getByReference.invalidate();
      utils.application.list.invalidate();
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (!app || !newStatus) return;
    updateStatus.mutate({ id: app.id, status: newStatus as typeof app.status });
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Application not found</p>
          <Link to="/admin/applications" className="text-[#C9A04C] hover:underline">Back to list</Link>
        </div>
      </div>
    );
  }

  const mainApplicant = app.applicants?.[0];
  const a: ApplicationWithLegacyAmount = app;
  const exchangeRate = Number(a.exchangeRate || 3.6725);
  const totalUsd = Number(a.totalAmountUsd || a.totalAmount || 0);
  const totalAed = Number(a.totalAmountAed || totalUsd * exchangeRate);

  const handleGenerateInvoice = () => {
    const invoiceNumber = app.invoiceNumber || `INV-${app.referenceNumber}`;
    const doc = generateInvoicePDF({
      invoiceNumber,
      referenceNumber: app.referenceNumber,
      createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : new Date().toISOString(),
      customerName: mainApplicant?.fullName || app.contactEmail?.split("@")[0] || "Customer",
      customerEmail: app.contactEmail || "",
      customerPhone: app.contactPhone || "",
      passportNumber: mainApplicant?.passportNumber || undefined,
      nationality: mainApplicant?.nationality || undefined,
      visaType: app.visaType || "",
      processingType: app.processingType || "",
      arrivalDate: app.arrivalDate || undefined,
      totalAmountUsd: totalUsd,
      exchangeRate,
      stripePaymentIntentId: app.stripePaymentIntentId || undefined,
    });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin/applications" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Application #{app.referenceNumber}</h1>
          <p className="text-xs text-gray-400">{app.visaType} · {app.processingType} · {app.applicants?.length || 0} applicant{(app.applicants?.length || 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[app.status] || ""}`}>{app.status}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            app.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
            app.paymentStatus === "failed" ? "bg-red-100 text-red-700" :
            "bg-amber-100 text-amber-700"
          }`}>{app.paymentStatus}</span>
          <select
            value={statusValue || app.status}
            onChange={(e) => { setStatusValue(e.target.value); handleStatusChange(e.target.value); }}
            className="px-3 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-lg text-xs focus:border-[#C9A04C] focus:outline-none"
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
          {updateStatus.isPending && <RefreshCw size={12} className="animate-spin text-[#C9A04C]" />}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-gray-100 p-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#C9A04C] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.key === "documents" && docCount && docCount.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-[#C9A04C]/10 text-[#C9A04C]"
                  }`}>
                    {docCount.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Details */}
              <div className="bg-white rounded-lg border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Customer Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Full Name</span>
                    <span className="font-medium">{mainApplicant?.fullName || "-"}</span>
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
                    <span>{mainApplicant?.nationality || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Profession</span>
                    <span>{mainApplicant?.profession || "-"}</span>
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
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Arrival Date</span>
                    <span>{app.arrivalDate || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-white rounded-lg border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                  <DollarSign size={14} /> Payment Summary
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Total (USD)</span>
                    <span className="font-bold text-lg text-[#C9A04C]">${totalUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Total (AED)</span>
                    <span className="font-bold text-lg text-emerald-600">AED {totalAed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Exchange Rate</span>
                    <span>{exchangeRate} AED/USD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Stripe PI</span>
                    <span className="font-mono text-xs">{app.stripePaymentIntentId || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Supplier */}
              <div className="bg-white rounded-lg border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                  <Building2 size={14} /> Supplier & Profit
                </h2>
                {app.supplier ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-xs text-gray-500">Supplier</p><p className="font-semibold">{app.supplier.name}</p></div>
                    <div><p className="text-xs text-gray-500">Contact</p><p>{app.supplier.contactPerson || "-"}</p></div>
                    <div><p className="text-xs text-gray-500">Cost (AED)</p><p className="font-semibold text-red-500">AED {Number(a.supplierCostAed || 0).toFixed(2)}</p></div>
                    <div><p className="text-xs text-gray-500">Profit (AED)</p><p className="font-semibold text-emerald-600">AED {(totalAed - Number(a.supplierCostAed || 0)).toFixed(2)}</p></div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No supplier assigned.</p>
                )}
              </div>
            </div>
          )}

          {/* Applicants Tab */}
          {activeTab === "applicants" && (
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={14} /> All Applicants ({app.applicants?.length || 0})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Full Name</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Nationality</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Passport</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Profession</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">GCC Residence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(app.applicants || []).map((ap, i) => (
                      <tr key={ap.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{ap.fullName}</td>
                        <td className="px-3 py-2 text-gray-500">{ap.nationality || "-"}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{ap.passportNumber || "-"}</td>
                        <td className="px-3 py-2 text-gray-500">{ap.profession || "-"}</td>
                        <td className="px-3 py-2 text-gray-500">{ap.gccResidenceNumber || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign size={14} /> Payment Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total (USD)</p>
                  <p className="text-xl font-bold text-[#C9A04C]">${totalUsd.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total (AED)</p>
                  <p className="text-xl font-bold text-emerald-600">AED {totalAed.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                  <p className={`text-sm font-semibold ${app.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{app.paymentStatus}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Invoice #</span>
                  <span className="font-mono">{app.invoiceNumber || `INV-${app.referenceNumber}`}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Stripe Payment Intent</span>
                  <span className="font-mono text-xs">{app.stripePaymentIntentId || "-"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Exchange Rate</span>
                  <span>{exchangeRate} AED/USD</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleGenerateInvoice} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm rounded-lg hover:shadow-md transition-all">
                  <Receipt size={14} /> Generate Invoice
                </button>
                {app.invoiceNumber && (
                  <>
                    <ViewInvoiceButton
                      invoiceNumber={app.invoiceNumber}
                      referenceNumber={app.referenceNumber}
                      totalAmountUsd={totalUsd}
                      exchangeRate={exchangeRate}
                      customerEmail={app.contactEmail}
                      customerPhone={app.contactPhone}
                      visaType={app.visaType}
                      processingType={app.processingType}
                    />
                    <DownloadInvoiceButton
                      invoiceNumber={app.invoiceNumber}
                      referenceNumber={app.referenceNumber}
                      totalAmountUsd={totalUsd}
                      exchangeRate={exchangeRate}
                      customerEmail={app.contactEmail}
                      customerPhone={app.contactPhone}
                      visaType={app.visaType}
                      processingType={app.processingType}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && app?.id && (
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FolderOpen size={14} /> Document Management
              </h2>
              <DocumentManager applicationId={app.id} />
            </div>
          )}

          {/* Notes Tab - Placeholder */}
          {activeTab === "notes" && (
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <StickyNote size={14} /> Notes
              </h2>
              <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-400 text-sm">Notes feature coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
