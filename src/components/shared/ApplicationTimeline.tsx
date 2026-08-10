import { useState } from "react";
import { Download, History, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc-client";

const OPERATIONAL_EVENTS = [
  "DOCUMENTS_VALIDATED", "ADDITIONAL_DOCUMENTS_REQUESTED", "GOVERNMENT_PROCESSING",
  "VISA_APPROVED", "VISA_ISSUED", "APPLICATION_COMPLETED", "APPLICATION_CANCELLED", "APPLICATION_REJECTED",
] as const;

function eventLabel(value: string) {
  return value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

export default function ApplicationTimeline({ referenceNumber, admin = false }: { referenceNumber: string; admin?: boolean }) {
  const utils = trpc.useUtils();
  const timeline = trpc.timeline.list.useQuery({ referenceNumber });
  const [eventName, setEventName] = useState<(typeof OPERATIONAL_EVENTS)[number]>("DOCUMENTS_VALIDATED");
  const operationalEvent = trpc.timeline.recordOperationalEvent.useMutation({
    onSuccess: () => utils.timeline.list.invalidate({ referenceNumber }),
  });
  const evidence = trpc.timeline.generateEvidenceManifest.useMutation();
  const evidenceDownload = trpc.timeline.recordEvidenceDownload.useMutation({
    onSuccess: () => utils.timeline.list.invalidate({ referenceNumber }),
  });

  const downloadEvidence = async () => {
    const result = await evidence.mutateAsync({ referenceNumber });
    const blob = new Blob([JSON.stringify({ sha256: result.sha256, manifest: result.manifest }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${referenceNumber}-chargeback-evidence.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    await evidenceDownload.mutateAsync({ referenceNumber, sha256: result.sha256 });
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-900">
          <History size={16} /> Application timeline
        </h2>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <select value={eventName} onChange={(event) => setEventName(event.target.value as typeof eventName)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">
              {OPERATIONAL_EVENTS.map((event) => <option key={event} value={event}>{eventLabel(event)}</option>)}
            </select>
            <button onClick={() => operationalEvent.mutate({ referenceNumber, eventName })} disabled={operationalEvent.isPending} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              <Plus size={13} /> Add event
            </button>
            <button onClick={downloadEvidence} disabled={evidence.isPending || evidenceDownload.isPending} className="inline-flex items-center gap-1 rounded-lg bg-[#C9A04C] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              <Download size={13} /> Evidence JSON
            </button>
          </div>
        )}
      </div>

      {timeline.isLoading ? <p className="text-sm text-gray-400">Loading timeline…</p> : timeline.data?.length ? (
        <ol className="space-y-0">
          {timeline.data.map((event) => (
            <li key={event.id} className="relative border-l-2 border-[#C9A04C]/30 pb-5 pl-5 last:pb-0">
              <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#C9A04C]" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{eventLabel(event.eventName)}</p>
                  {event.summary && <p className="mt-1 text-xs text-gray-500">{event.summary}</p>}
                </div>
                <time className="text-xs text-gray-400">{new Date(event.createdAt).toLocaleString()}</time>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-gray-400">
                <span>{event.actorType}</span><span>•</span><span>{event.eventSource}</span>
                {event.resultingState && <><span>•</span><span>{event.resultingState}</span></>}
                {admin && event.attemptNumber && <><span>•</span><span>Attempt {event.attemptNumber}</span></>}
                {admin && event.sanitizedCategory && <><span>•</span><span>{event.sanitizedCategory}</span></>}
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-gray-400">No timeline events have been recorded yet.</p>}
    </section>
  );
}
