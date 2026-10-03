import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import { COMPANY_FIELDS, type CompanyField } from "@contracts/company-settings";

export default function AdminCompanySettings() {
  const settings = trpc.business.settings.useQuery(undefined, { retry: false });
  const status = trpc.business.reopeningStatus.useQuery();
  const history = trpc.business.settingsHistory.useQuery();
  const save = trpc.business.createSettingsVersion.useMutation();
  const [notice, setNotice] = useState("");
  const current = settings.data;
  if (settings.isLoading) return <main className="p-6">Loading company settings…</main>;
  let provisional: CompanyField[] = [...COMPANY_FIELDS];
  try {
    const parsed: unknown = JSON.parse(current?.provisionalFieldsJson ?? "null");
    if (Array.isArray(parsed)) provisional = COMPANY_FIELDS.filter(field => parsed.includes(field));
  } catch { /* Missing review remains provisional. */ }
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <Link to="/admin/applications">← Administration</Link>
    <h1 className="text-2xl font-bold">Company identity and document review policy</h1>
    <p>Saving creates a new version. Previously issued documents retain their original identity and PDF. Saving does not reopen intake.</p>
    <section aria-live="polite" className="rounded border p-4">{status.data?.blockers.map(message => <p key={message}>{message}</p>)}</section>
    <form key={current?.version ?? "new"} className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setNotice("");
      const data = new FormData(event.currentTarget);
      const value = (key: string) => String(data.get(key) ?? "").trim();
      try {
        await save.mutateAsync({
          expectedVersion: current?.version ?? 0,
          legalName: value("legalName"), address: value("address"), licence: value("licence"),
          email: value("email"), phone: value("phone"), website: value("website"), logo: value("logo"),
          provisionalFields: COMPANY_FIELDS.filter(field => data.has(`provisional-${field}`)),
          passportMonths: Number(value("passportMonths")), residenceMonths: Number(value("residenceMonths")), childUnderYears: Number(value("childUnderYears")),
          vatRegistered: data.has("vatRegistered") ? "yes" : "no", trn: value("trn") || undefined,
          vatRate: value("vatRate") ? Number(value("vatRate")) : null,
          warningLevels: current ? JSON.parse(current.warningLevelsJson) : [80],
          registrationThreshold: Number(current?.registrationThreshold ?? 375000),
          invoicePrefix: current?.invoicePrefix ?? "TSH-INV-", nextInvoiceNumber: current?.nextInvoiceNumber ?? 1,
          baseCurrency: current?.baseCurrency ?? "AED", usdToBaseRate: Number(current?.usdToBaseRate ?? 3.6725), effectiveAt: new Date(),
        });
        await Promise.all([settings.refetch(), status.refetch(), history.refetch()]);
        setNotice("Settings version saved. Issued documents and invoice counters are unchanged.");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Settings could not be saved. Try again."); }
    }}>
      {COMPANY_FIELDS.map(field => <div key={field} className="rounded border p-3">
        <label className="block">{field}<input required name={field} type={field === "email" ? "email" : "text"} defaultValue={current?.[field] ?? ""} className="block w-full rounded border p-2" /></label>
        <label><input type="checkbox" name={`provisional-${field}`} defaultChecked={provisional.includes(field)} /> Provisional — blocks reopening</label>
      </div>)}
      {([ ["passportMonths", "Passport validity months", 6], ["residenceMonths", "Residence validity months", 3], ["childUnderYears", "Child under age", 12] ] as const).map(([field, label, initial]) =>
        <label key={field} className="block">{label}<input name={field} required type="number" min={1} max={field === "childUnderYears" ? 18 : 36} defaultValue={current?.[field] ?? initial} className="block rounded border p-2" /></label>)}
      <p>Validity is assessed from entry date. These thresholds flag human review; they do not block payment.</p>
      <label className="block"><input type="checkbox" name="vatRegistered" defaultChecked={current?.vatRegistered === "yes"} /> VAT registered</label>
      <label className="block">TRN<input name="trn" defaultValue={current?.trn ?? ""} className="block rounded border p-2" /></label>
      <label className="block">VAT rate (%)<input type="number" step="0.0001" min={0} max={100} name="vatRate" defaultValue={current?.vatRate ?? ""} className="block rounded border p-2" /></label>
      <button disabled={save.isPending} className="rounded bg-slate-900 px-5 py-3 text-white">Save new settings version</button>
      <p role="status">{notice}</p>
    </form>
    <h2 className="font-bold">Version history</h2>
    {history.data?.map(version => <p key={version.version}>Version {version.version} · {version.legalName} · {version.createdBy} · {String(version.effectiveAt)}</p>)}
  </main>;
}
