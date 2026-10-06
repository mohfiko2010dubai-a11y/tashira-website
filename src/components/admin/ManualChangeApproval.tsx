import { useState } from "react";
import { Link } from "react-router-dom";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";
import { trpc } from "@/providers/trpc-client";

type Decision = inferRouterOutputs<AppRouter>["application"]["manualChangeQueue"][number];
export function ManualChangeApproval({ row, refresh }: { row: Decision; refresh: () => void }) {
  const [password, setPassword] = useState(""), [reason, setReason] = useState(""), [verified, setVerified] = useState(false);
  const mutation = trpc.application.decideManualChange.useMutation({ onSuccess: () => { setPassword(""); refresh(); } });
  return <article className="space-y-3 rounded-xl border bg-white p-4">
    <Link className="font-semibold underline" to={`/admin/applications/${row.referenceNumber}`}>{row.referenceNumber}</Link>
    <p>{row.kind} · Quote version {row.version} · {row.outcome || row.direction}</p>
    <p>Requested by {row.requester} · {new Date(row.createdAt).toLocaleString()}</p>
    <p>{row.reason}</p>
    {row.stripeReference && <p className="break-all">Completed movement: {row.currency} {((row.amountMinor || 0) / 100).toFixed(2)} · {row.stripeReference}</p>}
    {row.writtenInsistence && <p>Customer insistence: {row.writtenInsistence}</p>}
    {row.riskRecord && <p>Recorded risk: {row.riskRecord}</p>}
    <label className="block"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /> I verified this evidence{row.stripeReference ? ", including the completed amount and reference in Stripe" : ""}. Approval records the decision and does not execute a payment or refund.</label>
    <label className="block">Decision reason<textarea className="block w-full rounded border p-3" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></label>
    <label className="block">Your account password<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
    <div className="flex flex-wrap gap-3">{[true, false].map(approve => <button key={String(approve)} className="min-h-11 rounded border px-4 disabled:opacity-40" disabled={mutation.isPending || !password || reason.trim().length < 5 || (approve && !verified)} onClick={() => mutation.mutate({ id: row.id, approve, password, reason })}>{approve ? "Approve recorded outcome" : "Reject"}</button>)}</div>
    {mutation.error && <p role="alert">{mutation.error.message}</p>}
  </article>;
}
