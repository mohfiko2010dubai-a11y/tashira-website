import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Search } from "lucide-react";
import { trpc } from "@/providers/trpc-client";

type Entry = { code: string; nameEn: string; nameAr: string; region: string };

/**
 * Chatbot smart inputs: a searchable governed country dropdown and a calendar
 * date picker, replacing free-text answers for nationality / country / date
 * steps. The picked value is submitted through the normal chat pipeline.
 */
export function ChatCountryPicker({ onPick, disabled }: { onPick: (countryName: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const catalog = trpc.dynamicInterview.nationalityCatalog.useQuery({});

  const entries = useMemo(() => {
    const all: readonly Entry[] = catalog.data?.nationalities ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.code.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(q));
  }, [catalog.data, query]);

  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 hover:border-[#C9A04C] disabled:opacity-50">
        <span className="flex items-center gap-2 text-gray-500"><Search size={14} /> Select from the list…</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to search…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-[12px] outline-none focus:border-[#C9A04C]" />
          </div>
          <div className="max-h-44 overflow-y-auto p-1">
            {entries.length === 0 && <p className="px-2 py-2 text-[11px] text-gray-400">No matches</p>}
            {entries.map((e) => (
              <button key={e.code} type="button" disabled={disabled}
                onClick={() => { setOpen(false); setQuery(""); onPick(e.nameEn); }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 hover:bg-[#C9A04C]/10 disabled:opacity-50">
                <span>{e.nameEn}</span>
                <span className="text-[10px] text-gray-400">{e.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatDatePicker({ onPick, disabled, min }: { onPick: (date: string) => void; disabled?: boolean; min?: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="date" value={value} min={min} disabled={disabled} onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] text-gray-700 outline-none focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C]/20 disabled:opacity-50" />
      </div>
      <button type="button" disabled={disabled || !value} onClick={() => { onPick(value); setValue(""); }}
        className="rounded-lg bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 hover:shadow-md">
        Confirm
      </button>
    </div>
  );
}
