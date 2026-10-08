import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const stateLabels: Record<string, string> = { REFUNDED: "تم الاسترداد", PARTIALLY_REFUNDED: "استرداد جزئي", CANCELLED: "ملغى", PENDING_APPROVAL: "بانتظار اعتماد المدير", APPROVED: "معتمد — بانتظار التنفيذ", PROCESSING: "جارٍ المعالجة", SUCCEEDED: "تم الاسترداد", COMPLETED: "مكتمل", FAILED: "فشل — راجع النتيجة", REJECTED: "مرفوض", PENDING: "قيد الانتظار", SENT: "تم الإرسال", NOT_SENT: "لم يُرسل", QUEUED: "في قائمة الإرسال", SUPPRESSED: "الإرسال موقوف", succeeded: "نجح", failed: "فشل", pending: "قيد الانتظار" };
const stateLabel = (value: string) => stateLabels[value] || value;
type DeductionType = "NONE" | "PERCENTAGE" | "FIXED" | "ACTUAL_COSTS";

export function RefundManager({ applicationId }: { applicationId: number }) {
  const utils = trpc.useUtils();
  const sources = trpc.refund.eligibleSources.useQuery({ applicationId });
  const cases = trpc.refund.listByApplication.useQuery({ applicationId });
  const [sourceKey, setSourceKey] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [deductionType, setDeductionType] = useState<DeductionType>("NONE");
  const [deductionValue, setDeductionValue] = useState("0");
  const [reason, setReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => sources.data?.find((source) => `${source.sourceType}:${source.id}` === sourceKey), [sourceKey, sources.data]);
  const refresh = async () => {
    await Promise.all([
      utils.refund.eligibleSources.invalidate({ applicationId }),
      utils.refund.listByApplication.invalidate({ applicationId }),
      utils.timeline.list.invalidate(),
    ]);
  };
  const mutationError = () => setMessage("لم يكتمل إجراء الاسترداد. راجع القيم وحاول مرة أخرى.");
  const createCase = trpc.refund.createCase.useMutation({ onError: mutationError, onSuccess: async () => {
    setMessage("تم إنشاء طلب الاسترداد؛ ينتظر الموافقة.");
    setReason("");
    await refresh();
  }});
  const approveCase = trpc.refund.approveCase.useMutation({ onError: mutationError, onSuccess: async () => {
    setMessage("تم اعتماد الاسترداد. اضغط تنفيذ الاسترداد لإرسال العملية إلى Stripe.");
    setAdminPassword("");
    await refresh();
  }});
  const executeCase = trpc.refund.executeCase.useMutation({ onError: mutationError, onSuccess: async (result) => {
    setMessage(`نتيجة الاسترداد في Stripe: ${stateLabel(result.status)}. بريد العميل: ${stateLabel(result.emailStatus)}.`);
    setAdminPassword("");
    await refresh();
  }});
  const reconcileCase = trpc.refund.reconcileCase.useMutation({ onError: mutationError, onSuccess: async (result) => {
    setMessage(`نتيجة المطابقة مع Stripe: ${stateLabel(result.status)}. بريد العميل: ${stateLabel(result.emailStatus)}.`);
    setAdminPassword("");
    await refresh();
  }});

  const deduction = deductionType === "NONE"
    ? { type: "NONE" as const }
    : { type: deductionType, value: Number(deductionValue) };

  return (
    <section dir="rtl" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">استرداد المبلغ</h3>
        <p className="text-sm text-gray-500">١. أنشئ طلب الاسترداد. ٢. اعتمده بكلمة سر المدير. ٣. نفّذ الاسترداد في Stripe. إنشاء الطلب والموافقة وحدهما لا يعيدان المبلغ.</p>
      </div>
      {message && <p role="status" className="min-h-11 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}
      {(sources.isLoading || cases.isLoading) && <p role="status">جارٍ تحميل الدفعات وطلبات الاسترداد…</p>}
      {(sources.error || cases.error) && <p role="alert" className="text-red-700">تعذر تحميل بيانات الاسترداد. حدّث الصفحة قبل المتابعة.</p>}
      {sources.data && !sources.data.some(source => source.availableAmount > 0) && <p className="rounded-xl bg-slate-50 p-3">لا توجد دفعة متاحة لإنشاء استرداد جديد. راجع طلبات الاسترداد القائمة أدناه.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-600">الدفعة المراد الاسترداد منها
          <select className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={sourceKey} onChange={(event) => {
            setSourceKey(event.target.value);
            const source = sources.data?.find((item) => `${item.sourceType}:${item.id}` === event.target.value);
            setRequestedAmount(source ? source.availableAmount.toFixed(2) : "");
          }}>
            <option value="">اختر دفعة يتوفر بها مبلغ قابل للاسترداد</option>
            {sources.data?.filter((source) => source.availableAmount > 0).map((source) => (
              <option key={`${source.sourceType}:${source.id}`} value={`${source.sourceType}:${source.id}`}>
                {source.sourceType === "VISA_SERVICE" ? "دفعة التأشيرة" : "التأمين المسترد"} — {source.currency} {source.availableAmount.toFixed(2)} متاح للاسترداد
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">المبلغ المطلوب استرداده
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="0.01" step="0.01" max={selected?.availableAmount} value={requestedAmount} onChange={(event) => setRequestedAmount(event.target.value)} />
        </label>
        <label className="text-sm text-gray-600">طريقة الخصم من الاسترداد
          <select className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={deductionType} onChange={(event) => setDeductionType(event.target.value as DeductionType)}>
            <option value="NONE">دون خصم</option>
            <option value="PERCENTAGE">نسبة خصم إدارية</option>
            <option value="FIXED">مبلغ خصم إداري ثابت</option>
            <option value="ACTUAL_COSTS">تكاليف فعلية موثّقة</option>
          </select>
        </label>
        {deductionType !== "NONE" && <label className="text-sm text-gray-600">قيمة الخصم
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="0" step="0.01" value={deductionValue} onChange={(event) => setDeductionValue(event.target.value)} />
        </label>}
      </div>
      <label className="block text-sm text-gray-600">سبب الاسترداد وأساس احتساب الخصم
        <textarea className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button className="min-h-11 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!selected || !reason.trim() || createCase.isPending} onClick={() => {
        if (!selected) return;
        createCase.mutate({
          applicationId,
          reason,
          policyVersion: TERMS_POLICY_VERSION,
          items: [selected.sourceType === "VISA_SERVICE"
            ? { sourceType: "VISA_SERVICE", paymentId: Number(selected.id), requestedAmount: Number(requestedAmount), deduction }
            : { sourceType: "SECURITY_DEPOSIT", securityDepositPaymentId: String(selected.id), requestedAmount: Number(requestedAmount), deduction }],
        });
      }}>١. إنشاء طلب استرداد</button>

      <div className="space-y-3">
        {cases.data?.map((refundCase) => (
          <div key={refundCase.id} className="min-h-11 rounded-lg border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono break-all text-gray-500">{refundCase.id}</span>
              <span className="font-semibold">{stateLabel(refundCase.status)}</span>
            </div>
            <p className="mt-2 text-gray-600">{refundCase.reason}</p>
            <div className="mt-2 space-y-1 text-gray-600">
              {refundCase.items.map((item) => (
                <p key={item.id}>
                  {item.sourceType === "VISA_SERVICE" ? "استرداد التأشيرة" : "استرداد التأمين"}: {item.currency} {Number(item.refundAmount).toFixed(2)}
                  {Number(item.requestedAmount) !== Number(item.refundAmount) ? " بعد تطبيق الخصم المسجّل" : ""} — {stateLabel(item.status)}
                </p>
              ))}
            </div>
            {(refundCase.status === "PENDING_APPROVAL" || refundCase.status === "APPROVED" || refundCase.status === "PROCESSING") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input className="min-w-48 rounded-lg border border-gray-200 p-2" type="password" autoComplete="current-password" placeholder="كلمة سر حساب المدير" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
                {refundCase.status === "PENDING_APPROVAL" && <button className="min-h-11 rounded-lg border border-emerald-600 px-3 py-2 font-semibold text-emerald-700 disabled:opacity-50" disabled={!adminPassword || approveCase.isPending} onClick={() => approveCase.mutate({ refundCaseId: refundCase.id, adminPassword })}>٢. اعتماد طلب الاسترداد</button>}
                {refundCase.status === "APPROVED" && <button className="min-h-11 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={!adminPassword || executeCase.isPending} onClick={() => executeCase.mutate({ refundCaseId: refundCase.id, adminPassword, confirmation: "EXECUTE REFUND" })}>٣. تنفيذ الاسترداد في Stripe</button>}
                {refundCase.status === "PROCESSING" && <button className="min-h-11 rounded-lg border border-blue-600 px-3 py-2 font-semibold text-blue-700 disabled:opacity-50" disabled={!adminPassword || reconcileCase.isPending} onClick={() => reconcileCase.mutate({ refundCaseId: refundCase.id, adminPassword, confirmation: "RECONCILE REFUND" })}>تحديث نتيجة الاسترداد من Stripe</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
