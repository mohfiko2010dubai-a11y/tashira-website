import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export default function SchedulerAlertPanel({ applicationId }: { applicationId: number }) {
  const query = trpc.operationsAlerts.list.useQuery({ applicationId }, { retry: false });
  const acknowledge = trpc.operationsAlerts.acknowledge.useMutation();
  const resolve = trpc.operationsAlerts.resolve.useMutation();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  if (query.isError) return null;
  if (!query.data || query.data.length === 0) return null;
  const act = async (alert: (typeof query.data)[number], action: "ACKNOWLEDGE" | "RESOLVE") => {
    const reason = reasons[alert.id]?.trim() ?? "";
    if (reason.length < 3) return;
    const command = { applicationId, alertId: alert.id, expectedVersion: alert.version,
      idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason };
    setMessage("");
    try {
      if (action === "ACKNOWLEDGE") await acknowledge.mutateAsync(command); else await resolve.mutateAsync(command);
      setReasons((current) => ({ ...current, [alert.id]: "" }));
      await query.refetch(); setMessage(`${action} recorded with audit evidence.`);
    } catch (error) {
      const conflict = error instanceof Error && /CONFLICT|CONCURRENCY/i.test(error.message);
      setMessage(conflict ? "This alert changed. Refresh and review the latest version." : "The alert action could not be recorded safely.");
    }
  };
  return <section className="mx-auto mt-6 max-w-7xl rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="scheduler-alert-actions">
    <h2 id="scheduler-alert-actions" className="text-lg font-semibold">Scheduler Alert Actions</h2>
    <p className="mt-1 text-sm text-slate-600">Only the approved lifecycle actions below are available. Every action requires current-version evidence.</p>
    {message && <p role="status" className="mt-3 rounded-lg bg-white p-3 text-sm">{message}</p>}
    <div className="mt-4 space-y-3">{query.data.filter((alert) => alert.state !== "RESOLVED").map((alert) => <article key={alert.id} className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong>{alert.type} · {alert.severity}</strong><span>Version {alert.version} · {alert.state}</span></div>
      <label className="mt-3 block text-sm font-medium">Reason
        <input className="mt-1 w-full rounded-lg border p-2" value={reasons[alert.id] ?? ""}
          onChange={(event) => setReasons((current) => ({ ...current, [alert.id]: event.target.value }))} />
      </label>
      <div className="mt-3 flex gap-2">
        {alert.state === "CREATED" && <button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={() => void act(alert, "ACKNOWLEDGE")}>Acknowledge</button>}
        <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => void act(alert, "RESOLVE")}>Resolve</button>
      </div>
    </article>)}</div>
  </section>;
}
