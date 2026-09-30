import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ResidenceType = "non-gcc" | "gcc-resident" | "gcc-accompany";
export default function ResidenceTypeSelect({ value, onChange }: { value: ResidenceType; onChange: (value: ResidenceType) => void }) {
  const { i18n } = useTranslation();const ar = i18n.language.startsWith("ar");
  return <div role="group" aria-label={ar ? "نوع الإقامة" : "Residence type"} className="grid gap-3 sm:grid-cols-3">
    {(["non-gcc", "gcc-resident", "gcc-accompany"] as const).map(type => <button type="button" key={type} aria-pressed={value === type}
      onClick={() => onChange(type)} className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center ${value === type ? "border-[#C9A04C] bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 shadow-sm" : "border-gray-200 hover:border-[#DDBB7A]"}`}>
      {value === type && <span className="absolute top-3 end-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A04C] text-white"><Check size={12} /></span>}
      <strong className="text-sm text-[#0A1628]">{type === "non-gcc" ? (ar ? "مقيم خارج دول الخليج" : "Non-GCC Resident") : type === "gcc-resident" ? (ar ? "مقيم في دول الخليج" : "GCC Resident") : (ar ? "مرافق مقيم خليجي" : "GCC Resident Accompanying")}</strong>
    </button>)}
  </div>;
}
