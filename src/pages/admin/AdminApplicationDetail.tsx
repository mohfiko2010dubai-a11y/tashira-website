import { ManualVisaChange } from '@/components/admin/ManualVisaChange';
import { visaLabel, applicationStatusLabels, formatFeeMinor } from '@/components/admin/application-display';
import { DocumentValidityReview } from "@/components/admin/DocumentValidityReview";
import Logo from '@/components/shared/Logo';
import { ApplicationSupplementReview } from "@/components/admin/ApplicationSupplementReview";
import { ApplicationDocumentDiagnostics } from "@/components/admin/ApplicationDocumentDiagnostics";
import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import {
  ArrowLeft, Building2, RefreshCw,
  Users, DollarSign, ClipboardList, StickyNote, FolderOpen,
  History,
} from "lucide-react";
import { ViewInvoiceButton, DownloadInvoiceButton } from "@/components/shared/InvoiceButton";
import DocumentManager from "@/components/shared/DocumentManager";
import type { ApplicationWithLegacyAmount } from "@/types/trpc";
import ApplicationTimeline from "@/components/shared/ApplicationTimeline";
import { RefundManager } from "@/components/admin/RefundManager";
import { ProcessingGuarantee } from "@/components/admin/ProcessingGuarantee";
import { SecurityDepositManager } from "@/components/admin/SecurityDepositManager";

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
  { key: "overview", label: "ملخص الطلب", icon: ClipboardList },
  { key: "applicants", label: "المسافرون", icon: Users },
  { key: "documents", label: "المستندات والمراجعة", icon: FolderOpen },
  { key: "change", label: "تعديل التأشيرة", icon: RefreshCw },
  { key: "payments", label: "المدفوعات والاسترداد", icon: DollarSign },
  { key: "timeline", label: "سجل العمليات", icon: History },
  { key: "notes", label: "ملاحظات العميل", icon: StickyNote },
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
  const { data: app, isLoading, error: applicationError } = trpc.application.getByReference.useQuery(
    { referenceNumber: referenceNumber || "" },
    { enabled: !!referenceNumber },
  );

  const { data: docCount } = trpc.document.countByApplication.useQuery(
    { applicationId: app?.id || 0 },
    { enabled: !!app?.id },
  );
  const fees = trpc.business.orderFees.useQuery({ applicationId: app?.id || 0 }, { enabled: !!app?.id });
  const reconcileFee = trpc.business.reconcileOrderFee.useMutation({ onSuccess: () => { void fees.refetch(); } });
  const { data: risk } = trpc.risk.latest.useQuery(
    { referenceNumber: referenceNumber || "" },
    { enabled: !!referenceNumber },
  );
  const { data: timelineEvents } = trpc.timeline.list.useQuery(
    { referenceNumber: referenceNumber || "" },
    { enabled: !!referenceNumber },
  );
  const assessRisk = trpc.risk.assess.useMutation({
    onSuccess: () => utils.risk.latest.invalidate({ referenceNumber: referenceNumber || "" }),
  });

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
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">جارٍ التحميل…</div>;
  }

  if (applicationError) return <div dir="rtl" className="p-8"><p role="alert">تعذر تحميل الطلب. حدّث الصفحة أو سجّل الدخول مرة أخرى.</p><Link to="/admin/applications" className="underline">العودة إلى الطلبات</Link></div>;

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">لم يتم العثور على الطلب</p>
          <Link to="/admin/applications" className="text-[#C9A04C] hover:underline">العودة إلى الطلبات</Link>
        </div>
      </div>
    );
  }

  const mainApplicant = app.applicants?.find((applicant) => Number(applicant.applicantIndex) === 0);
  const payerAuthorization = timelineEvents?.filter((event) => event.eventName === "PAYER_AUTHORIZATION_ACCEPTED").at(-1);
  const a: ApplicationWithLegacyAmount = app;
  const exchangeRate = Number(a.exchangeRate || 0);
  const totalUsd = Number(a.totalAmountUsd || a.totalAmount || 0);
  const totalAed = Number(a.totalAmountAed || totalUsd * exchangeRate);

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-slate-50 text-base leading-relaxed text-slate-800">
      {/* Header */}
      <header className="bg-[#1A2332] text-white px-4 sm:px-8 py-6 flex flex-wrap items-center gap-4">
        <Link to="/admin/applications" aria-label="العودة إلى قائمة الطلبات" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold"><Logo variant="mark-only" theme="dark" size={20} /> ملف الطلب <bdi className="block break-all text-sm font-normal text-slate-300">{app.referenceNumber}</bdi></h1>
          <p className="text-sm text-gray-400">{visaLabel(app.visaType)} · {app.processingType === "express" ? "معالجة مستعجلة" : "معالجة عادية"} · {app.applicants?.length || 0} مسافر</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[app.status] || ""}`}>{applicationStatusLabels[app.status] || app.status}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            app.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
            app.paymentStatus === "failed" ? "bg-red-100 text-red-700" :
            "bg-amber-100 text-amber-700"
          }`}>{applicationStatusLabels[app.paymentStatus] || app.paymentStatus}</span>
          <select
            value={statusValue || app.status}
            aria-label="حالة الطلب الجديدة"
            onChange={(e) => setStatusValue(e.target.value)}
            className="px-3 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none"
          >
            <option value="submitted">تم استلام الطلب</option>
            <option value="payment_received">تم استلام الدفع</option>
            <option value="documents_pending">بانتظار المستندات</option>
            <option value="documents_received">تم استلام المستندات</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="visa_processing">قيد المعالجة لدى الجهة</option>
            <option value="visa_received">تم استلام التأشيرة</option>
            <option value="completed">مكتمل</option>
            <option value="rejected">مرفوض</option>
            <option value="cancelled">ملغى</option>
          </select>
          <button className="min-h-11 rounded-xl bg-white px-4 py-2 font-semibold text-slate-900 disabled:opacity-50" disabled={!statusValue || statusValue === app.status || updateStatus.isPending} onClick={() => handleStatusChange(statusValue)}>حفظ الحالة</button>
          {updateStatus.isPending && <RefreshCw size={12} className="animate-spin text-[#C9A04C]" />}
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8">
        {updateStatus.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{updateStatus.error.message}</p>}
        {updateStatus.isSuccess && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">تم حفظ حالة الطلب.</p>}
        {app.emailDeliveryIssue && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">تعذر توصيل بريد للعميل. راجع عنوان البريد وسجل الإرسال قبل الاعتماد على إشعار جديد.</p>}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">العميل</p><p className="mt-2 text-lg font-bold">{mainApplicant?.fullName || 'لم يُسجّل الاسم'}</p><bdi className="mt-1 block break-all text-sm text-slate-600">{app.contactEmail}</bdi></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">قيمة الطلب المسجلة</p><p dir="ltr" className="mt-2 text-start text-2xl font-bold">{totalUsd.toFixed(2)} USD</p><p className="mt-1 text-sm">حالة الدفع: {applicationStatusLabels[app.paymentStatus] || app.paymentStatus}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold">ابدأ من المستندات والمراجعة</p><p className="mt-2 text-sm text-slate-600">راجع الملفات، سجّل قرارك، ثم افتح تعديل التأشيرة أو المدفوعات عند الحاجة.</p><button onClick={() => setActiveTab('documents')} className="mt-2 min-h-11 font-semibold text-amber-900 underline">فتح المستندات والمراجعة</button></div>
        </div>
        {/* Tabs */}
        <div aria-label="أقسام الطلب" className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={isActive}
                className={`min-h-12 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#C9A04C] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.key === "documents" && docCount && docCount.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-sm ${
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
          {activeTab === 'change' && <><DocumentValidityReview referenceNumber={app.referenceNumber} mode="change" /><ManualVisaChange referenceNumber={app.referenceNumber} /></>}
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Details */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 ">بيانات العميل</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">الاسم الكامل</span>
                    <span className="font-medium">{mainApplicant?.fullName || "-"}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">البريد الإلكتروني</span>
                    <span>{app.contactEmail}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">الهاتف</span>
                    <span>{app.contactPhone}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">الجنسية</span>
                    <span>{mainApplicant?.nationality || "-"}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2">
                    <span className="text-gray-500">المهنة</span>
                    <span>{mainApplicant?.profession || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Application Details */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 ">بيانات الطلب</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">رقم الطلب</span>
                    <span className="font-mono break-all font-semibold text-[#C9A04C]">{app.referenceNumber}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">نوع التأشيرة</span>
                    <span>{visaLabel(app.visaType)}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">سرعة المعالجة</span>
                    <span>{app.processingType === "express" ? "مستعجلة" : "عادية"}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">نوع الطلب</span>
                    <span>{app.baseType === "family" ? "طلب عائلي" : "مسافر واحد"}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2">
                    <span className="text-gray-500">تاريخ الوصول</span>
                    <span>{app.arrivalDate || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                <h2 className="text-lg font-semibold text-gray-900 mb-4  flex items-center gap-2">
                  <DollarSign size={14} /> ملخص القيمة
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">قيمة الطلب بالدولار</span>
                    <span className="font-bold text-lg text-[#C9A04C]">${totalUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">القيمة بالدرهم</span>
                    <span className="font-bold text-lg text-emerald-600">AED {totalAed.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                    <span className="text-gray-500">سعر الصرف</span>
                    <span>{exchangeRate} AED/USD</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 break-words py-2">
                    <span className="text-gray-500">مرجع الدفع في Stripe</span>
                    <span className="font-mono text-sm break-all">{app.stripePaymentIntentId || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Supplier */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                <h2 className="text-lg font-semibold text-gray-900 mb-4  flex items-center gap-2">
                  <Building2 size={14} /> المورد والتكلفة والربح
                </h2>
                {app.supplier ? (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-sm text-gray-500">المورد</p><p className="font-semibold">{app.supplier.name}</p></div>
                    <div><p className="text-sm text-gray-500">جهة الاتصال</p><p>{app.supplier.contactPerson || "-"}</p></div>
                    <div><p className="text-sm text-gray-500">التكلفة بالدرهم</p><p className="font-semibold text-red-500">AED {Number(a.supplierCostAed || 0).toFixed(2)}</p></div>
                    <div><p className="text-sm text-gray-500">الربح بالدرهم</p><p className="font-semibold text-emerald-600">AED {(totalAed - Number(a.supplierCostAed || 0)).toFixed(2)}</p></div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">لم يُحدد مورد بعد.</p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 ">تقييم المخاطر المساعد</h2>
                  <button onClick={() => assessRisk.mutate({ referenceNumber: app.referenceNumber })} disabled={assessRisk.isPending} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">تحديث التقييم</button>
                </div>
                {risk ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p><span className="text-gray-500">المستوى:</span> <strong>{risk.level}</strong></p>
                    <p><span className="text-gray-500">الدرجة:</span> {risk.score}/100</p>
                    <p className="text-sm text-gray-400">تقييم استرشادي؛ لا يرفض الطلب تلقائيًا.</p>
                  </div>
                ) : <p className="mt-4 text-sm text-gray-400">لا يوجد تقييم مسجّل.</p>}
              </div>
            </div>
          )}

          {/* Applicants Tab */}
          {activeTab === "applicants" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={14} /> المسافرون ({app.applicants?.length || 0})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">الاسم الكامل</th>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">الجنسية</th>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">رقم الجواز</th>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">المهنة</th>
                      <th className="text-start px-3 py-2 font-semibold text-gray-600">رقم الإقامة الخليجية</th>
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
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign size={14} /> المدفوعات والفواتير
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">قيمة الطلب بالدولار</p>
                  <p className="text-xl font-bold text-[#C9A04C]">${totalUsd.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">القيمة بالدرهم</p>
                  <p className="text-xl font-bold text-emerald-600">AED {totalAed.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">حالة الدفع</p>
                  <p className={`text-sm font-semibold ${app.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{applicationStatusLabels[app.paymentStatus] || app.paymentStatus}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">المسافر</span>
                  <span>{mainApplicant?.fullName || "-"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">صاحب الدفع</span>
                  <span>{payerAuthorization?.actorReference || "غير مسجّل"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">صلة صاحب الدفع بالمسافر</span>
                  <span>{payerAuthorization?.sanitizedCategory || "-"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">البطاقة</span>
                  <span>غير متاح</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">تفويض الدفع</span>
                  <span className={payerAuthorization ? "font-semibold text-emerald-700" : "text-gray-500"}>{payerAuthorization ? "تمت الموافقة ✓" : "غير مسجّل"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">رقم الفاتورة</span>
                  <span className="font-mono">{app.invoiceNumber || "لم تُصدر بعد"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2 border-b border-gray-50">
                  <span className="text-gray-500">مرجع الدفع في Stripe</span>
                  <span className="font-mono text-sm break-all">{app.stripePaymentIntentId || "-"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 break-words py-2">
                  <span className="text-gray-500">سعر الصرف</span>
                  <span>{exchangeRate} AED/USD</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {app.invoiceNumber && (
                  <>
                    <ViewInvoiceButton
                      language="ar" invoiceNumber={app.invoiceNumber}
                      referenceNumber={app.referenceNumber}
                      totalAmountUsd={totalUsd}
                      exchangeRate={exchangeRate}
                      customerEmail={app.contactEmail}
                      customerPhone={app.contactPhone}
                      visaType={app.visaType}
                      processingType={app.processingType}
                    />
                    <DownloadInvoiceButton
                      language="ar" invoiceNumber={app.invoiceNumber}
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
              <details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">طلب تأمين مسترد — عند الحاجة</summary><SecurityDepositManager applicationId={app.id} /></details>
<section dir="rtl" className="rounded-xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-bold">رسوم معالجة الدفع لدى Stripe</h2><p className="mt-1 text-sm text-slate-600">رسوم المعالج المسجلة لهذه الدفعات؛ ليست قيمة التأشيرة أو مبلغًا إضافيًا على العميل.</p>
{fees.isLoading && <p role="status">جارٍ تحميل الرسوم…</p>}{fees.error && <p role="alert">تعذر تحميل الرسوم. حدّث الصفحة للمحاولة مرة أخرى.</p>}
{fees.data && !fees.data.some(payment => payment.status === 'succeeded') && <p className="mt-3">لا توجد دفعات ناجحة لعرض رسومها.</p>}
{fees.data?.filter(payment => payment.status === 'succeeded').map(payment => <div key={payment.paymentId} className="mt-4 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p>دفعة رقم {payment.paymentId}<strong className="mt-1 block text-lg">{payment.feeMinor === null ? 'لم تُطابق الرسوم بعد' : payment.currency ? formatFeeMinor(payment.feeMinor, payment.currency) : "عملة الرسوم غير مسجّلة — حدّث من Stripe"}</strong></p><button className="min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:opacity-50" disabled={reconcileFee.isPending} onClick={() => reconcileFee.mutate({ paymentId: payment.paymentId })}>تحديث الرسوم من Stripe</button></div><details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer">معرّف حركة Stripe</summary><bdi className="mt-2 block break-all">{payment.balanceTransaction || 'غير مسجّل'}</bdi></details></div>)}
{reconcileFee.error && <p role="alert" className="mt-3 text-red-700">{reconcileFee.error.message}</p>}{reconcileFee.isSuccess && <p role="status" className="mt-3 text-emerald-700">تم تحديث الرسوم من Stripe.</p>}</section>
              <ProcessingGuarantee applicationId={app.id} />
              <RefundManager applicationId={app.id} />
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && app?.id && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FolderOpen size={14} /> المستندات والمراجعة
              </h2>
              <p className="mb-4 text-slate-600">١. افتح المستندات وتأكد من وضوحها ومطابقتها للبيانات، ثم سجّل نتيجة المراجعة أدناه.</p>
              <DocumentManager applicationId={app.id} language="ar" />
              <div className="mt-6"><DocumentValidityReview referenceNumber={app.referenceNumber} /></div>
              <ApplicationDocumentDiagnostics applicants={app.documentRuleDiagnostics} />
            </div>
          )}

          {activeTab === "timeline" && (
            <ApplicationTimeline referenceNumber={app.referenceNumber} admin language="ar" />
          )}

          {activeTab === "notes" && <ApplicationSupplementReview applicationId={app.id} />}

        </div>
      </div>
    </div>
  );
}
