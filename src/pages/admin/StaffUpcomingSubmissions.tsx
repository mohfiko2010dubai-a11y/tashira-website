import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";

export default function StaffUpcomingSubmissions() {
  const query = trpc.operationsRead.upcomingSubmissions.useQuery({}, { retry: false });
  if (query.isLoading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading submission queue…</main>;
  if (query.isError || !query.data) return <main className="min-h-screen bg-slate-50 p-8 text-center">Submission queue unavailable for this Operations scope.</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl">
    <header className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Operations</p>
      <h1 className="mt-2 text-2xl font-bold">Upcoming Submissions</h1><p className="mt-1 text-sm text-slate-300">Server-authoritative schedule, readiness and current alert evidence.</p></header>
    <div className="mt-6 grid gap-4">{query.data.length === 0 ? <p className="rounded-xl bg-white p-5">No permitted submissions.</p> : query.data.map((item) => <article key={`${item.applicationId}:${item.travelGroupId}`} className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{item.applicationReference} · {item.travelGroupReference}</h2>
        <p className="text-sm text-slate-500">{item.routeCode} · Planned travel {item.plannedArrivalDate}</p></div><div className="flex gap-2 text-xs font-semibold"><span className="rounded-full bg-slate-100 px-3 py-1">{item.category}</span>
          {item.currentAlert && <span className="rounded-full bg-amber-100 px-3 py-1">{item.currentAlert.severity} · {item.currentAlert.state}</span>}</div></div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-slate-500">Target submission</dt><dd>{item.targetSubmissionDate ?? "Not established"}</dd></div>
        <div><dt className="text-slate-500">Latest safe date</dt><dd>{item.latestSafeSubmissionDate ?? "Not established"}</dd></div>
        <div><dt className="text-slate-500">Countdown</dt><dd>{item.countdownDays === null ? "Not established" : `${item.countdownDays} days`}</dd></div>
        <div><dt className="text-slate-500">Assigned</dt><dd>{item.assignedActorId ?? "Unassigned"}</dd></div></dl>
      {(item.currentAlert || item.blockingReasons.length > 0) && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">{item.currentAlert?.reason ?? item.blockingReasons.join(", ")}</p>}
      <Link className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" to={`/staff/operations/${item.applicationReference}`}>Open case and alert actions</Link>
    </article>)}</div>
  </div></main>;
}
