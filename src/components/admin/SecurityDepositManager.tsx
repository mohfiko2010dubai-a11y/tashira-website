import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export function SecurityDepositManager({ applicationId }: { applicationId: number }) {
  const utils = trpc.useUtils();
  const requests = trpc.securityDeposit.listByApplication.useQuery({ applicationId });
  const [amount, setAmount] = useState("2500");
  const [purpose, setPurpose] = useState("Refundable security deposit requested for this application");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [message, setMessage] = useState("");
  const createRequest = trpc.securityDeposit.createAndSend.useMutation({
    onSuccess: async (result) => {
      setMessage(result.status === "SENT" ? "Security-deposit request sent successfully." : "Request saved, but email delivery failed. Do not create a duplicate until reviewed.");
      await Promise.all([
        utils.securityDeposit.listByApplication.invalidate({ applicationId }),
        utils.timeline.list.invalidate(),
      ]);
    },
    onError: () => setMessage("Security-deposit request was not created. Review the values and try again."),
  });

  return (
    <section className="border-t border-gray-100 pt-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Refundable Security Deposit</h3>
        <p className="text-xs text-gray-500">Set the amount per application. The customer receives an expiring, single-purpose payment link by email.</p>
      </div>
      {message && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">{message}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs text-gray-600">Amount (AED)
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="1" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="text-xs text-gray-600 md:col-span-2">Purpose
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" maxLength={255} value={purpose} onChange={(event) => setPurpose(event.target.value)} />
        </label>
        <label className="text-xs text-gray-600">Link validity (days)
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="1" max="30" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} />
        </label>
      </div>
      <button className="rounded-lg bg-[#C9A04C] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={createRequest.isPending || Number(amount) <= 0 || purpose.trim().length < 5} onClick={() => createRequest.mutate({
        applicationId,
        amount: Number(amount),
        purpose,
        expiresInDays: Number(expiresInDays),
      })}>Send security-deposit request</button>
      <div className="space-y-2">
        {requests.data?.map((request) => (
          <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-xs">
            <span>{request.currency} {Number(request.amount).toFixed(2)} — {request.purpose}</span>
            <span className="font-semibold">{request.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
