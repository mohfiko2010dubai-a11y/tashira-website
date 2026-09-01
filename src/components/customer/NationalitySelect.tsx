import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { isRtlLanguage } from "@/lib/rtl";
import { useTranslation } from "react-i18next";

type Entry = { code: string; nameEn: string; nameAr: string; region: string };

/**
 * Governed nationality picker: CLOSED dropdown that opens on click, with
 * in-menu search. Stores the ISO 3166-1 alpha-2 CODE (never free text),
 * matching the server-side catalog validation.
 */
export default function NationalitySelect({ value, onChange }: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { i18n } = useTranslation();
  const isArabic = isRtlLanguage(i18n.language);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const catalog = trpc.dynamicInterview.nationalityCatalog.useQuery({});

  const entries = useMemo(() => {
    const all: readonly Entry[] = catalog.data?.nationalities ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.code.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(q));
  }, [catalog.data, query]);

  const selected = (catalog.data?.nationalities ?? []).find((e) => e.code === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery(""); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-start transition-colors ${
          open ? "border-[#C9A04C] ring-1 ring-[#C9A04C]" : "border-gray-300 hover:border-[#DDBB7A]"
        }`}
      >
        <span className={`text-sm ${selected ? "font-semibold text-[#0A1628]" : "text-gray-400"}`}>
          {selected ? (isArabic ? selected.nameAr : selected.nameEn) : isArabic ? "اختر الجنسية…" : "Select nationality…"}
        </span>
        <span className="flex items-center gap-2">
          {selected && <span className="text-xs text-gray-400">{selected.code}</span>}
          <ChevronDown size={18} className={`text-[#C9A04C] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Search size={16} className="text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isArabic ? "ابحث عن الجنسية…" : "Search nationality…"}
              className="w-full bg-transparent text-sm focus:outline-none"
              autoComplete="off"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Nationality">
            {catalog.isLoading && <p className="px-3 py-2 text-sm text-gray-400">Loading…</p>}
            {catalog.isError && <p className="px-3 py-2 text-sm text-rose-600">Catalog unavailable — please retry.</p>}
            {entries.map((e) => (
              <button
                key={e.code}
                type="button"
                role="option"
                aria-selected={value === e.code}
                onClick={() => { onChange(e.code); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
                  value === e.code ? "bg-[#C9A04C]/10 font-semibold text-[#0A1628]" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{isArabic ? e.nameAr : e.nameEn}</span>
                <span className="ms-3 text-xs text-gray-400">{e.code}</span>
              </button>
            ))}
            {catalog.data && entries.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">{isArabic ? "لا توجد نتائج مطابقة" : "No matching nationality"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
