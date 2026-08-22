import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

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
  const mutationError = () => setMessage("The refund action was not completed. Review the values and try again.");
  const createCase = trpc.refund.createCase.useMutation({ onError: mutationError, onSuccess: async () => {
    setMessage("Refund case created and awaiting approval.");
    setReason("");
    await refresh();
  }});
  const approveCase = trpc.refund.approveCase.useMutation({ onError: mutationError, onSuccess: async () => {
    setMessage("Refund case approved. Execution remains a separate action.");
    setAdminPassword("");
    await refresh();
  }});
  const executeCase = trpc.refund.executeCase.useMutation({ onError: mutationError, onSuccess: async (result) => {
    setMessage(`Stripe refund result: ${result.status}.`);
    setAdminPassword("");
    await refresh();
  }});
  const reconcileCase = trpc.refund.reconcileCase.useMutation({ onError: mutationError, onSuccess: async (result) => {
    setMessage(`Stripe reconciliation result: ${result.status}.`);
    setAdminPassword("");
    await refresh();
  }});

  const deduction = deductionType === "NONE"
    ? { type: "NONE" as const }
    : { type: deductionType, value: Number(deductionValue) };

  return (
    <section className="border-t border-gray-100 pt-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Refund Management</h3>
        <p className="text-xs text-gray-500">Create → re-authenticate and approve → explicitly execute through Stripe. Every stage is auditable and idempotent.</p>
      </div>
      {message && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">{message}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-gray-600">Payment source
          <select className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={sourceKey} onChange={(event) => {
            setSourceKey(event.target.value);
            const source = sources.data?.find((item) => `${item.sourceType}:${item.id}` === event.target.value);
            setRequestedAmount(source ? source.availableAmount.toFixed(2) : "");
          }}>
            <option value="">Select a refundable payment</option>
            {sources.data?.filter((source) => source.availableAmount > 0).map((source) => (
              <option key={`${source.sourceType}:${source.id}`} value={`${source.sourceType}:${source.id}`}>
                {source.sourceType === "VISA_SERVICE" ? "Visa payment" : "Security deposit"} — {source.currency} {source.availableAmount.toFixed(2)} available
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">Requested amount
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="0.01" step="0.01" max={selected?.availableAmount} value={requestedAmount} onChange={(event) => setRequestedAmount(event.target.value)} />
        </label>
        <label className="text-xs text-gray-600">Deduction method
          <select className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" value={deductionType} onChange={(event) => setDeductionType(event.target.value as DeductionType)}>
            <option value="NONE">Full refund</option>
            <option value="PERCENTAGE">Administrative percentage</option>
            <option value="FIXED">Fixed administrative amount</option>
            <option value="ACTUAL_COSTS">Documented actual costs</option>
          </select>
        </label>
        {deductionType !== "NONE" && <label className="text-xs text-gray-600">Deduction value
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="0" step="0.01" value={deductionValue} onChange={(event) => setDeductionValue(event.target.value)} />
        </label>}
      </div>
      <label className="block text-xs text-gray-600">Reason and cost basis
        <textarea className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!selected || !reason.trim() || createCase.isPending} onClick={() => {
        if (!selected) return;
        createCase.mutate({
          applicationId,
          reason,
          policyVersion: TERMS_POLICY_VERSION,
          items: [selected.sourceType === "VISA_SERVICE"
            ? { sourceType: "VISA_SERVICE", paymentId: Number(selected.id), requestedAmount: Number(requestedAmount), deduction }
            : { sourceType: "SECURITY_DEPOSIT", securityDepositPaymentId: String(selected.id), requestedAmount: Number(requestedAmount), deduction }],
        });
      }}>Create refund case</button>

      <div className="space-y-3">
        {cases.data?.map((refundCase) => (
          <div key={refundCase.id} className="rounded-lg border border-gray-200 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-gray-500">{refundCase.id}</span>
              <span className="font-semibold">{refundCase.status}</span>
            </div>
            <p className="mt-2 text-gray-600">{refundCase.reason}</p>
            <div className="mt-2 space-y-1 text-gray-600">
              {refundCase.items.map((item) => (
                <p key={item.id}>
                  {item.sourceType === "VISA_SERVICE" ? "Visa" : "Deposit"}: {item.currency} {Number(item.refundAmount).toFixed(2)} refund
                  {Number(item.requestedAmount) !== Number(item.refundAmount) ? ` after ${item.deductionType.toLowerCase()} deduction` : ""} — {item.status}
                </p>
              ))}
            </div>
            {(refundCase.status === "PENDING_APPROVAL" || refundCase.status === "APPROVED" || refundCase.status === "PROCESSING") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input className="min-w-48 rounded-lg border border-gray-200 p-2" type="password" autoComplete="current-password" placeholder="Admin password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
                {refundCase.status === "PENDING_APPROVAL" && <button className="rounded-lg border border-emerald-600 px-3 py-2 font-semibold text-emerald-700 disabled:opacity-50" disabled={!adminPassword || approveCase.isPending} onClick={() => approveCase.mutate({ refundCaseId: refundCase.id, adminPassword })}>Approve</button>}
                {refundCase.status === "APPROVED" && <button className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white disabled:opacity-50" disabled={!adminPassword || executeCase.isPending} onClick={() => executeCase.mutate({ refundCaseId: refundCase.id, adminPassword, confirmation: "EXECUTE REFUND" })}>Execute Stripe refund</button>}
                {refundCase.status === "PROCESSING" && <button className="rounded-lg border border-blue-600 px-3 py-2 font-semibold text-blue-700 disabled:opacity-50" disabled={!adminPassword || reconcileCase.isPending} onClick={() => reconcileCase.mutate({ refundCaseId: refundCase.id, adminPassword, confirmation: "RECONCILE REFUND" })}>Reconcile Stripe status</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
