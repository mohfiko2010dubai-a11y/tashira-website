import { Link } from "react-router-dom";
import { ArrowLeft, Activity, AlertTriangle, DollarSign, Percent, Receipt, TrendingUp } from "lucide-react";
import { trpc } from "@/providers/trpc-client";

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof DollarSign }) {
  return <div className="rounded-xl border border-gray-100 bg-white p-4"><div className="mb-2 flex items-center gap-2 text-xs text-gray-500"><Icon size={14} />{label}</div><p className="text-xl font-bold text-gray-900">{value}</p></div>;
}

export default function AdminFinanceCockpit() {
  const cockpit = trpc.business.cockpit.useQuery();
  if (cockpit.isLoading) return <div className="min-h-screen bg-gray-50 p-8 text-gray-400">Loading finance cockpit…</div>;
  if (!cockpit.data) return <div className="min-h-screen bg-gray-50 p-8 text-red-600">Finance settings and pricing snapshots must be configured first.</div>;
  const data = cockpit.data;
  const money = (value: number) => `${data.currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <div className="min-h-screen bg-gray-50">
    <header className="flex items-center gap-3 bg-[#1A2332] px-6 py-4 text-white"><Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link><div><h1 className="font-bold">Finance Cockpit</h1><p className="text-xs text-gray-400">Server-authoritative snapshots and append-only financial events</p></div></header>
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Revenue" value={money(data.revenue)} icon={DollarSign} />
        <Metric label="Gross profit" value={money(data.grossProfit)} icon={TrendingUp} />
        <Metric label="Gross margin" value={`${data.grossMargin.toFixed(1)}%`} icon={Percent} />
        <Metric label="Average order" value={money(data.averageOrderValue)} icon={Receipt} />
        <Metric label="Supplier cost" value={money(data.supplierCost)} icon={DollarSign} />
        <Metric label="Payment success" value={data.paymentSuccessRate === null ? "No data" : `${data.paymentSuccessRate.toFixed(1)}%`} icon={Activity} />
        <Metric label="Refund requests" value={String(data.refundRequests)} icon={AlertTriangle} />
        <Metric label="Chargebacks" value={String(data.chargebacks)} icon={AlertTriangle} />
      </div>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5"><h2 className="font-semibold">VAT registration monitor</h2><div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-[#C9A04C]" style={{ width: `${data.vatMonitor.progressPercent ?? 0}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p>Relevant sales: <strong>{money(data.vatMonitor.currentRelevantSales)}</strong></p><p>Threshold: <strong>{money(data.vatMonitor.threshold)}</strong></p><p>Remaining: <strong>{money(data.vatMonitor.remainingAmount)}</strong></p><p>Forecast threshold: <strong>{data.vatMonitor.estimatedThresholdDate ? new Date(data.vatMonitor.estimatedThresholdDate).toLocaleDateString() : "Insufficient data"}</strong></p></div><p className="mt-3 text-xs text-gray-400">Threshold and warning levels are configuration, not embedded legal advice.</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-5"><h2 className="font-semibold">Business Health Score</h2><p className="mt-3 text-4xl font-bold text-[#C9A04C]">{data.businessHealth.score}/100</p><div className="mt-4 space-y-2">{data.businessHealth.components.map((component) => <div key={component.name} className="flex justify-between text-sm"><span className="capitalize text-gray-500">{component.name}</span><span>{component.points.toFixed(1)} / {component.maximum}</span></div>)}</div><p className="mt-3 text-xs text-gray-400">Explainable indicator only; it makes no automated decisions.</p></div>
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-5"><h2 className="font-semibold">Monthly paid-order trend</h2><div className="mt-4 space-y-2">{data.monthlyTrend.length ? data.monthlyTrend.map((row) => <div key={row.month} className="grid grid-cols-3 border-b border-gray-50 py-2 text-sm"><span>{row.month}</span><span>{money(Number(row.revenue))}</span><span>{row.orders} orders</span></div>) : <p className="text-sm text-gray-400">No paid snapshot data.</p>}</div></section>
    </main>
  </div>;
}
