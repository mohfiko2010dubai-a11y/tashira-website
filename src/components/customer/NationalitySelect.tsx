import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { isRtlLanguage } from "@/lib/rtl";
import { useTranslation } from "react-i18next";

type Entry = { code: string; nameEn: string; nameAr: string; region: string };

/**
 * Governed nationality picker: searchable, bilingual, stores the ISO 3166-1
 * alpha-2 CODE (never free text), matching the server-side catalog validation.
 */
export default function NationalitySelect({ value, onChange }: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { i18n } = useTranslation();
  const isArabic = isRtlLanguage(i18n.language);
  const [query, setQuery] = useState("");
  const catalog = trpc.dynamicInterview.nationalityCatalog.useQuery({});

  const entries = useMemo(() => {
    const all: readonly Entry[] = catalog.data?.nationalities ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.code.toLowerCase().includes(q) || e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(q));
  }, [catalog.data, query]);

  const selected = (catalog.data?.nationalities ?? []).find((e) => e.code === value);

  return (
    <div className="rounded-xl border border-gray-300 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <Search size={16} className="text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isArabic ? "ابحث عن الجنسية…" : "Search nationality…"}
          className="w-full bg-transparent text-sm focus:outline-none"
          autoComplete="off"
        />
        {selected && (
          <span className="shrink-0 rounded-full bg-[#C9A04C]/10 px-3 py-1 text-xs font-bold text-[#C9A04C]">
            {isArabic ? selected.nameAr : selected.nameEn} ({selected.code})
          </span>
        )}
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
            onClick={() => onChange(e.code)}
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
  );
}
