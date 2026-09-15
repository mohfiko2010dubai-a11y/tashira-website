import { OWNER_DOCUMENTS } from "../../../contracts/owner-document-requirements";

const cardCopy: Record<string, { en: string; ar: string; hintEn: string; hintAr: string }> = {
  HOME_NATIONAL_ID: { en: "National ID card", ar: "بطاقة الهوية الوطنية", hintEn: "Issued by your home country", hintAr: "الصادرة من بلدك" },
  KSA_RESIDENCE_PROOF: { en: "Proof of residence", ar: "إثبات الإقامة", hintEn: "From Muqeem OR Absher — either one", hintAr: "من مقيم أو أبشر — أي واحد منهما" },
  SA_ABSHER_REPORT: { en: "Absher residence report", ar: "تقرير الإقامة من أبشر", hintEn: "A separate file from the proof above", hintAr: "ملف منفصل غير الإثبات السابق" },
};

export function documentCardCopy(card: { key: string; pair?: "passport" | "residence" }, nationality: string | null | undefined, ar: boolean) {
  const definition = OWNER_DOCUMENTS.find(item => item.code === card.key);
  const copy = cardCopy[card.key];
  const label = card.pair === "passport" ? ar ? "جواز السفر" : "Passport" : card.pair === "residence" ? card.key === "OMN_RESIDENCE_FRONT" ? ar ? "بطاقة الهوية العمانية / بطاقة مقيم (Resident Card)" : "Omani ID / Resident Card (بطاقة مقيم)" : ar ? "بطاقة الإقامة" : "Residence permit" : copy ? ar ? copy.ar : copy.en : definition ? ar ? definition.ar : definition.en : card.key;
  const hint = card.pair === "passport" ? nationality === "PK" ? ar ? "الصفحة الثانية مطلوبة للجنسية الباكستانية" : "Second page required for Pakistani nationals" : ar ? "الصفحة الأولى والأخيرة" : "First and last passport pages" : card.pair === "residence" ? ar ? "صورتان — الوجه والظهر" : "Two images — front and back" : copy ? ar ? copy.hintAr : copy.hintEn : definition ? ar ? definition.hintAr : definition.hintEn : "";
  return { label, hint };
}

export function documentGroupHeading(key: "identity" | "residence" | "supporting", country: string | null | undefined, ar: boolean) {
  const name = country ? new Intl.DisplayNames([ar ? "ar" : "en"], { type: "region" }).of(country) : "";
  return key === "identity" ? ar ? "الهوية" : "Identity" : key === "residence" ? ar ? `الإقامة في ${name}` : `Residence in ${name}` : ar ? "مستندات إضافية" : "Supporting documents";
}
