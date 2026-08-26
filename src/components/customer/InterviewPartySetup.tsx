import { useState } from "react";

export type PartyApplicant = { applicantId: number; applicantIndex: number; fullName: string; nationality: string | null;
  residenceCountry: string | null; profileVersion: number };
export type PartyRelationship = { relationshipEventId: string; fromApplicantId: number; toApplicantId: number;
  relationship: "SPOUSE" | "PARENT" | "CHILD" | "GUARDIAN" | "DEPENDENT" | "SIBLING" | "OTHER" };
type WritableRelationship = Exclude<PartyRelationship["relationship"], "SIBLING" | "OTHER">;
export type PartyTravelGroup = { travelGroupId: string; version: number; reference: string; applicantIds: readonly number[];
  primaryTravellerId: number; accompanyingAdultId: number | null; arrangement: "TOGETHER" | "SEPARATELY"; origin: string;
  destination: string; plannedArrivalDate: string; plannedDepartureDate: string | null; ticketStatus: "NOT_BOOKED" | "RESERVED" | "CONFIRMED" };
export type PartySharedDocument = { documentId: number; documentType: "OUTBOUND_TICKET" | "RETURN_TICKET" | "ONWARD_TICKET" |
  "ROUND_TRIP_TICKET" | "FAMILY_BOOKING"; applicantIds: readonly number[] };
export type PartySetup = { applicants: readonly PartyApplicant[]; relationships: readonly PartyRelationship[];
  travelGroups: readonly PartyTravelGroup[]; sharedDocuments: readonly PartySharedDocument[] };

type Profile = { fullName: string; nationality: string | null; residenceCountry: string | null };
type TravelInput = Omit<PartyTravelGroup, "travelGroupId" | "version" | "applicantIds"> & { applicantIds: number[] };
type Props = { setup: PartySetup; busy?: boolean; error?: boolean;
  onAddApplicant: (profile: Profile) => Promise<void>; onEditApplicant: (applicant: PartyApplicant, profile: Profile) => Promise<void>;
  onDefineRelationship: (fromApplicantId: number, toApplicantId: number, relationship: WritableRelationship) => Promise<void>;
  onCreateTravelGroup: (group: TravelInput) => Promise<void>; onUpdateTravelGroup: (group: PartyTravelGroup, update: TravelInput) => Promise<void>;
  onLinkSharedDocument: (document: PartySharedDocument, applicantIds: number[]) => Promise<void> };

const emptyProfile: Profile = { fullName: "", nationality: null, residenceCountry: null };
const asNullable = (value: string) => value.trim() || null;

export function InterviewPartySetup({ setup, busy = false, error = false, onAddApplicant, onEditApplicant,
  onDefineRelationship, onCreateTravelGroup, onUpdateTravelGroup, onLinkSharedDocument }: Props) {
  const [adding, setAdding] = useState(false); const [newProfile, setNewProfile] = useState(emptyProfile);
  const [editingId, setEditingId] = useState<number | null>(null); const [editingProfile, setEditingProfile] = useState(emptyProfile);
  const [relationship, setRelationship] = useState<{ from: number; to: number; type: WritableRelationship } | null>(null);
  const lead = setup.applicants[0] ?? null;
  const [travelDraft, setTravelDraft] = useState<TravelInput | null>(null);
  const [documentDraft, setDocumentDraft] = useState<{ document: PartySharedDocument; applicantIds: number[] } | null>(null);
  const [editingTravelGroupId, setEditingTravelGroupId] = useState<string | null>(null);
  const startTravel = (group?: PartyTravelGroup) => { setEditingTravelGroupId(group?.travelGroupId ?? null); setTravelDraft(group ? { reference: group.reference, applicantIds: [...group.applicantIds],
    primaryTravellerId: group.primaryTravellerId, accompanyingAdultId: group.accompanyingAdultId, arrangement: group.arrangement,
    origin: group.origin, destination: group.destination, plannedArrivalDate: group.plannedArrivalDate,
    plannedDepartureDate: group.plannedDepartureDate, ticketStatus: group.ticketStatus } : lead ? { reference: "Main travel group",
      applicantIds: setup.applicants.map((item) => item.applicantId), primaryTravellerId: lead.applicantId, accompanyingAdultId: lead.applicantId,
      arrangement: "TOGETHER", origin: "", destination: "DXB", plannedArrivalDate: "", plannedDepartureDate: null,
      ticketStatus: "NOT_BOOKED" } : null); };
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="party-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-[#9b7425]">Travel party</p>
      <h2 id="party-heading" className="mt-1 text-2xl font-bold text-slate-950">Applicants and travel arrangements</h2>
      <p className="mt-2 text-sm text-slate-600">Each person keeps an independent profile, requirements and document ownership.</p></div>
      <button type="button" onClick={() => setAdding(true)} className="rounded-xl border border-[#b48a36] px-4 py-2 font-semibold text-[#795918]">Add applicant</button></div>
    {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">We could not save that change. Refresh the current application and try again.</p>}
    <div className="mt-6 grid gap-3">{setup.applicants.map((applicant) => <article key={applicant.applicantId} className="rounded-2xl border border-slate-200 p-4">
      {editingId === applicant.applicantId ? <ProfileFields profile={editingProfile} setProfile={setEditingProfile} /> : <div className="flex flex-wrap items-center justify-between gap-3"><div>
        <h3 className="font-semibold text-slate-950">Applicant {applicant.applicantIndex + 1}: {applicant.fullName}</h3>
        <p className="mt-1 text-sm text-slate-600">Nationality: {applicant.nationality ?? "To be completed"} · Residence: {applicant.residenceCountry ?? "To be completed"}</p></div>
        <button type="button" className="text-sm font-semibold text-[#795918] underline" onClick={() => { setEditingId(applicant.applicantId);
          setEditingProfile({ fullName: applicant.fullName, nationality: applicant.nationality, residenceCountry: applicant.residenceCountry }); }}>Edit profile</button></div>}
      {editingId === applicant.applicantId && <div className="mt-3 flex gap-2"><button type="button" disabled={busy || editingProfile.fullName.trim().length < 2}
        className="rounded-lg bg-[#cda64f] px-4 py-2 font-semibold disabled:opacity-50" onClick={async () => { await onEditApplicant(applicant, editingProfile); setEditingId(null); }}>Save</button>
        <button type="button" className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setEditingId(null)}>Cancel</button></div>}
    </article>)}</div>
    {adding && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold">New applicant</h3><ProfileFields profile={newProfile} setProfile={setNewProfile} />
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy || newProfile.fullName.trim().length < 2} className="rounded-lg bg-[#cda64f] px-4 py-2 font-semibold disabled:opacity-50"
        onClick={async () => { await onAddApplicant(newProfile); setNewProfile(emptyProfile); setAdding(false); }}>Add applicant</button>
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={() => setAdding(false)}>Cancel</button></div></div>}
    {lead && setup.applicants.length > 1 && <div className="mt-6 rounded-2xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-950">Relationships to lead applicant</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{setup.applicants.slice(1).map((applicant) => { const existing = setup.relationships.find((item) => item.fromApplicantId === lead.applicantId && item.toApplicantId === applicant.applicantId);
        return <div key={applicant.applicantId} className="rounded-xl bg-white p-3"><p className="text-sm font-medium">{applicant.fullName}</p><p className="text-xs text-slate-500">{existing?.relationship ?? "Relationship not set"}</p>
          {!existing && <button type="button" className="mt-2 text-sm font-semibold text-[#795918] underline" onClick={() => setRelationship({ from: lead.applicantId, to: applicant.applicantId, type: "DEPENDENT" })}>Set relationship</button>}</div>; })}</div></div>}
    {relationship && <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 p-4"><label className="grid gap-1 text-sm font-medium">Relationship<select className="rounded-lg border border-slate-300 px-3 py-2" value={relationship.type}
      onChange={(event) => setRelationship({ ...relationship, type: event.target.value as WritableRelationship })}>{["SPOUSE", "PARENT", "CHILD", "GUARDIAN", "DEPENDENT"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" disabled={busy} className="rounded-lg bg-[#cda64f] px-4 py-2 font-semibold" onClick={async () => { await onDefineRelationship(relationship.from, relationship.to, relationship.type); setRelationship(null); }}>Save relationship</button>
      <button type="button" className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setRelationship(null)}>Cancel</button></div>}
    <div className="mt-7 flex items-center justify-between"><h3 className="font-semibold text-slate-950">Travel groups</h3><button type="button" onClick={() => startTravel()} className="text-sm font-semibold text-[#795918] underline">Create travel group</button></div>
    <div className="mt-3 grid gap-3">{setup.travelGroups.map((group) => <article key={group.travelGroupId} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-4"><div><p className="font-semibold">{group.reference}</p><p className="mt-1 text-sm text-slate-600">{group.origin} → {group.destination} · {group.plannedArrivalDate} · {group.applicantIds.length} applicant(s)</p></div>
      <button type="button" className="text-sm font-semibold text-[#795918] underline" onClick={() => startTravel(group)}>Edit</button></div></article>)}</div>
    {travelDraft && <TravelFields setup={setup} draft={travelDraft} setDraft={setTravelDraft} busy={busy} onCancel={() => { setTravelDraft(null); setEditingTravelGroupId(null); }}
      onSave={async () => { const current = setup.travelGroups.find((item) => item.travelGroupId === editingTravelGroupId);
        if (current) await onUpdateTravelGroup(current, travelDraft); else await onCreateTravelGroup(travelDraft); setTravelDraft(null); setEditingTravelGroupId(null); }} />}
    {setup.sharedDocuments.length > 0 && <div className="mt-7"><h3 className="font-semibold text-slate-950">Shared travel documents</h3>
      <p className="mt-1 text-sm text-slate-600">Link one existing booking or ticket to every traveller it covers. The original file remains unchanged.</p>
      <div className="mt-3 grid gap-3">{setup.sharedDocuments.map((document) => <article key={document.documentId} className="rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{document.documentType.replaceAll("_", " ")}</p>
          <p className="mt-1 text-sm text-slate-600">Linked to {document.applicantIds.length} applicant(s)</p></div>
          <button type="button" className="text-sm font-semibold text-[#795918] underline" onClick={() => setDocumentDraft({ document,
            applicantIds: [...document.applicantIds] })}>Update travellers</button></div></article>)}</div></div>}
    {documentDraft && <fieldset className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><legend className="px-1 font-semibold">Travellers covered by {documentDraft.document.documentType.replaceAll("_", " ")}</legend>
      <p className="mt-1 text-sm text-slate-600">Existing links are retained as immutable evidence. You may add other applicants from this application.</p>
      <div className="mt-3 flex flex-wrap gap-3">{setup.applicants.map((applicant) => { const existing = documentDraft.document.applicantIds.includes(applicant.applicantId);
        return <label key={applicant.applicantId} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={documentDraft.applicantIds.includes(applicant.applicantId)}
          disabled={existing} onChange={(event) => setDocumentDraft({ ...documentDraft, applicantIds: event.target.checked
            ? [...documentDraft.applicantIds, applicant.applicantId] : documentDraft.applicantIds.filter((id) => id !== applicant.applicantId) })}/>{applicant.fullName}</label>; })}</div>
      <div className="mt-4 flex gap-2"><button type="button" disabled={busy || documentDraft.applicantIds.length === documentDraft.document.applicantIds.length}
        className="rounded-lg bg-[#cda64f] px-4 py-2 font-semibold disabled:opacity-50" onClick={async () => { await onLinkSharedDocument(documentDraft.document,
          documentDraft.applicantIds); setDocumentDraft(null); }}>Save document links</button>
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={() => setDocumentDraft(null)}>Cancel</button></div></fieldset>}
  </section>;
}

function ProfileFields({ profile, setProfile }: { profile: Profile; setProfile: (profile: Profile) => void }) {
  return <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm font-medium">Full name<input className="rounded-lg border border-slate-300 px-3 py-2" value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}/></label>
    <label className="grid gap-1 text-sm font-medium">Nationality<input className="rounded-lg border border-slate-300 px-3 py-2" value={profile.nationality ?? ""} onChange={(event) => setProfile({ ...profile, nationality: asNullable(event.target.value) })}/></label>
    <label className="grid gap-1 text-sm font-medium">Country of residence<input className="rounded-lg border border-slate-300 px-3 py-2" value={profile.residenceCountry ?? ""} onChange={(event) => setProfile({ ...profile, residenceCountry: asNullable(event.target.value) })}/></label></div>;
}

function TravelFields({ setup, draft, setDraft, busy, onCancel, onSave }: { setup: PartySetup; draft: TravelInput;
  setDraft: (value: TravelInput) => void; busy: boolean; onCancel: () => void; onSave: () => Promise<void> }) {
  const field = "rounded-lg border border-slate-300 px-3 py-2";
  return <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold">Travel group details</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm font-medium">Group name<input className={field} value={draft.reference} onChange={(event) => setDraft({ ...draft, reference: event.target.value })}/></label>
    <label className="grid gap-1 text-sm font-medium">Arrangement<select className={field} value={draft.arrangement} onChange={(event) => setDraft({ ...draft, arrangement: event.target.value as TravelInput["arrangement"] })}><option>TOGETHER</option><option>SEPARATELY</option></select></label>
    <label className="grid gap-1 text-sm font-medium">Origin<input className={field} value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })}/></label>
    <label className="grid gap-1 text-sm font-medium">Destination<input className={field} value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })}/></label>
    <label className="grid gap-1 text-sm font-medium">Arrival date<input type="date" className={field} value={draft.plannedArrivalDate} onChange={(event) => setDraft({ ...draft, plannedArrivalDate: event.target.value })}/></label>
    <label className="grid gap-1 text-sm font-medium">Departure date<input type="date" className={field} value={draft.plannedDepartureDate ?? ""} onChange={(event) => setDraft({ ...draft, plannedDepartureDate: asNullable(event.target.value) })}/></label>
    <label className="grid gap-1 text-sm font-medium">Primary traveller<select className={field} value={draft.primaryTravellerId} onChange={(event) => setDraft({ ...draft, primaryTravellerId: Number(event.target.value) })}>{setup.applicants.filter((item) => draft.applicantIds.includes(item.applicantId)).map((item) => <option key={item.applicantId} value={item.applicantId}>{item.fullName}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Accompanying adult<select className={field} value={draft.accompanyingAdultId ?? ""} onChange={(event) => setDraft({ ...draft, accompanyingAdultId: event.target.value ? Number(event.target.value) : null })}><option value="">Not specified</option>{setup.applicants.filter((item) => draft.applicantIds.includes(item.applicantId)).map((item) => <option key={item.applicantId} value={item.applicantId}>{item.fullName}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Ticket status<select className={field} value={draft.ticketStatus} onChange={(event) => setDraft({ ...draft, ticketStatus: event.target.value as TravelInput["ticketStatus"] })}><option>NOT_BOOKED</option><option>RESERVED</option><option>CONFIRMED</option></select></label></div>
    <fieldset className="mt-4"><legend className="text-sm font-semibold">Travellers</legend><div className="mt-2 flex flex-wrap gap-3">{setup.applicants.map((applicant) => <label key={applicant.applicantId} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.applicantIds.includes(applicant.applicantId)} onChange={(event) => setDraft({ ...draft,
      ...(() => { const applicantIds = event.target.checked ? [...draft.applicantIds, applicant.applicantId] : draft.applicantIds.filter((id) => id !== applicant.applicantId);
        return { applicantIds, primaryTravellerId: applicantIds.includes(draft.primaryTravellerId) ? draft.primaryTravellerId : (applicantIds[0] ?? 0),
          accompanyingAdultId: draft.accompanyingAdultId !== null && applicantIds.includes(draft.accompanyingAdultId) ? draft.accompanyingAdultId : null }; })() })}/>{applicant.fullName}</label>)}</div></fieldset>
    <div className="mt-4 flex gap-2"><button type="button" disabled={busy || !draft.reference.trim() || !draft.origin.trim() || !draft.destination.trim() || !draft.plannedArrivalDate || draft.applicantIds.length === 0}
      className="rounded-lg bg-[#cda64f] px-4 py-2 font-semibold disabled:opacity-50" onClick={onSave}>Save travel group</button><button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={onCancel}>Cancel</button></div></div>;
}
