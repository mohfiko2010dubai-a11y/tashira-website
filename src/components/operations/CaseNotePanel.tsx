import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export default function CaseNotePanel({ referenceNumber, onRecorded }: { referenceNumber: string; onRecorded(): Promise<void> }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const record = trpc.timeline.recordOperationalEvent.useMutation();
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">Internal case note</h2>
    <p className="mt-1 text-sm text-slate-500">Adds an attributable, timestamped operational note to the case timeline. Do not include card data or secrets.</p>
    <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} rows={3} className="mt-3 w-full rounded-lg border border-slate-300 p-3" placeholder="Record the reason, customer request or next action…" />
    <button type="button" disabled={note.trim().length < 3 || record.isPending} onClick={async () => { setMessage(""); try { await record.mutateAsync({ referenceNumber, eventName: "DISPUTE_NOTE_ADDED", summary: note.trim() }); setNote(""); setMessage("Note added to the timeline."); await onRecorded(); } catch { setMessage("The note could not be recorded for this permission scope."); } }} className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{record.isPending ? "Recording…" : "Add internal note"}</button>
    {message && <p role="status" className="mt-2 text-sm text-slate-600">{message}</p>}
  </section>;
}
