/**
 * Governed nationality catalog (ISO 3166-1 alpha-2).
 *
 * The Dynamic Interview stores the ISO CODE as the answer value — never a
 * free-text label — so eligibility rules can match nationalities reliably.
 * Labels are provided in English and Arabic for the customer UI.
 *
 * This dataset is a code-level governed catalog: changing it requires a code
 * review, and it is identical across environments. Country names and ISO
 * codes are public standard data (ISO 3166-1), not regulatory content.
 */
export type NationalityEntry = {
  /** ISO 3166-1 alpha-2 code, e.g. "EG". This is what gets stored. */
  code: string;
  nameEn: string;
  nameAr: string;
  region: "GCC" | "ARAB" | "ASIA" | "AFRICA" | "EUROPE" | "AMERICAS" | "OCEANIA";
};

const gcc = (code: string, nameEn: string, nameAr: string): NationalityEntry => ({ code, nameEn, nameAr, region: "GCC" });
const arab = (code: string, nameEn: string, nameAr: string): NationalityEntry => ({ code, nameEn, nameAr, region: "ARAB" });
const entry = (code: string, nameEn: string, nameAr: string, region: NationalityEntry["region"]): NationalityEntry => ({ code, nameEn, nameAr, region });

export const NATIONALITY_CATALOG: readonly NationalityEntry[] = [
  // GCC
  gcc("AE", "United Arab Emirates", "الإمارات العربية المتحدة"),
  gcc("SA", "Saudi Arabia", "المملكة العربية السعودية"),
  gcc("KW", "Kuwait", "الكويت"),
  gcc("QA", "Qatar", "قطر"),
  gcc("BH", "Bahrain", "البحرين"),
  gcc("OM", "Oman", "عُمان"),
  // Arab countries
  arab("EG", "Egypt", "مصر"),
  arab("JO", "Jordan", "الأردن"),
  arab("LB", "Lebanon", "لبنان"),
  arab("SY", "Syria", "سوريا"),
  arab("IQ", "Iraq", "العراق"),
  arab("YE", "Yemen", "اليمن"),
  arab("SD", "Sudan", "السودان"),
  arab("LY", "Libya", "ليبيا"),
  arab("TN", "Tunisia", "تونس"),
  arab("DZ", "Algeria", "الجزائر"),
  arab("MA", "Morocco", "المغرب"),
  arab("MR", "Mauritania", "موريتانيا"),
  arab("SO", "Somalia", "الصومال"),
  arab("DJ", "Djibouti", "جيبوتي"),
  arab("KM", "Comoros", "جزر القمر"),
  arab("PS", "Palestine", "فلسطين"),
  // Asia
  entry("IN", "India", "الهند", "ASIA"),
  entry("PK", "Pakistan", "باكستان", "ASIA"),
  entry("BD", "Bangladesh", "بنغلاديش", "ASIA"),
  entry("LK", "Sri Lanka", "سريلانكا", "ASIA"),
  entry("NP", "Nepal", "نيبال", "ASIA"),
  entry("PH", "Philippines", "الفلبين", "ASIA"),
  entry("ID", "Indonesia", "إندونيسيا", "ASIA"),
  entry("MY", "Malaysia", "ماليزيا", "ASIA"),
  entry("TH", "Thailand", "تايلاند", "ASIA"),
  entry("VN", "Vietnam", "فيتنام", "ASIA"),
  entry("CN", "China", "الصين", "ASIA"),
  entry("JP", "Japan", "اليابان", "ASIA"),
  entry("KR", "South Korea", "كوريا الجنوبية", "ASIA"),
  entry("SG", "Singapore", "سنغافورة", "ASIA"),
  entry("HK", "Hong Kong", "هونغ كونغ", "ASIA"),
  entry("TW", "Taiwan", "تايوان", "ASIA"),
  entry("AF", "Afghanistan", "أفغانستان", "ASIA"),
  entry("IR", "Iran", "إيران", "ASIA"),
  entry("TR", "Turkey", "تركيا", "ASIA"),
  entry("KZ", "Kazakhstan", "كازاخستان", "ASIA"),
  entry("UZ", "Uzbekistan", "أوزبكستان", "ASIA"),
  entry("AZ", "Azerbaijan", "أذربيجان", "ASIA"),
  entry("GE", "Georgia", "جورجيا", "ASIA"),
  entry("AM", "Armenia", "أرمينيا", "ASIA"),
  entry("MN", "Mongolia", "منغوليا", "ASIA"),
  entry("MM", "Myanmar", "ميانمار", "ASIA"),
  entry("KH", "Cambodia", "كمبوديا", "ASIA"),
  entry("LA", "Laos", "لاوس", "ASIA"),
  entry("BN", "Brunei", "بروناي", "ASIA"),
  // Africa
  entry("NG", "Nigeria", "نيجيريا", "AFRICA"),
  entry("GH", "Ghana", "غانا", "AFRICA"),
  entry("KE", "Kenya", "كينيا", "AFRICA"),
  entry("ET", "Ethiopia", "إثيوبيا", "AFRICA"),
  entry("UG", "Uganda", "أوغندا", "AFRICA"),
  entry("TZ", "Tanzania", "تنزانيا", "AFRICA"),
  entry("ZA", "South Africa", "جنوب أفريقيا", "AFRICA"),
  entry("SN", "Senegal", "السنغال", "AFRICA"),
  entry("CI", "Ivory Coast", "ساحل العاج", "AFRICA"),
  entry("CM", "Cameroon", "الكاميرون", "AFRICA"),
  entry("RW", "Rwanda", "رواندا", "AFRICA"),
  entry("ER", "Eritrea", "إريتريا", "AFRICA"),
  entry("ML", "Mali", "مالي", "AFRICA"),
  entry("NE", "Niger", "النيجر", "AFRICA"),
  entry("TD", "Chad", "تشاد", "AFRICA"),
  entry("GN", "Guinea", "غينيا", "AFRICA"),
  entry("BF", "Burkina Faso", "بوركينا فاسو", "AFRICA"),
  entry("ZW", "Zimbabwe", "زيمبابوي", "AFRICA"),
  entry("MZ", "Mozambique", "موزمبيق", "AFRICA"),
  entry("MG", "Madagascar", "مدغشقر", "AFRICA"),
  // Europe
  entry("GB", "United Kingdom", "المملكة المتحدة", "EUROPE"),
  entry("IE", "Ireland", "أيرلندا", "EUROPE"),
  entry("FR", "France", "فرنسا", "EUROPE"),
  entry("DE", "Germany", "ألمانيا", "EUROPE"),
  entry("IT", "Italy", "إيطاليا", "EUROPE"),
  entry("ES", "Spain", "إسبانيا", "EUROPE"),
  entry("PT", "Portugal", "البرتغال", "EUROPE"),
  entry("NL", "Netherlands", "هولندا", "EUROPE"),
  entry("BE", "Belgium", "بلجيكا", "EUROPE"),
  entry("CH", "Switzerland", "سويسرا", "EUROPE"),
  entry("AT", "Austria", "النمسا", "EUROPE"),
  entry("SE", "Sweden", "السويد", "EUROPE"),
  entry("NO", "Norway", "النرويج", "EUROPE"),
  entry("DK", "Denmark", "الدنمارك", "EUROPE"),
  entry("FI", "Finland", "فنلندا", "EUROPE"),
  entry("PL", "Poland", "بولندا", "EUROPE"),
  entry("CZ", "Czech Republic", "التشيك", "EUROPE"),
  entry("HU", "Hungary", "المجر", "EUROPE"),
  entry("RO", "Romania", "رومانيا", "EUROPE"),
  entry("BG", "Bulgaria", "بلغاريا", "EUROPE"),
  entry("GR", "Greece", "اليونان", "EUROPE"),
  entry("HR", "Croatia", "كرواتيا", "EUROPE"),
  entry("SK", "Slovakia", "سلوفاكيا", "EUROPE"),
  entry("SI", "Slovenia", "سلوفينيا", "EUROPE"),
  entry("EE", "Estonia", "إستونيا", "EUROPE"),
  entry("LV", "Latvia", "لاتفيا", "EUROPE"),
  entry("LT", "Lithuania", "ليتوانيا", "EUROPE"),
  entry("LU", "Luxembourg", "لوكسمبورغ", "EUROPE"),
  entry("MT", "Malta", "مالطا", "EUROPE"),
  entry("CY", "Cyprus", "قبرص", "EUROPE"),
  entry("RU", "Russia", "روسيا", "EUROPE"),
  entry("UA", "Ukraine", "أوكرانيا", "EUROPE"),
  entry("BY", "Belarus", "بيلاروسيا", "EUROPE"),
  entry("MD", "Moldova", "مولدوفا", "EUROPE"),
  entry("RS", "Serbia", "صربيا", "EUROPE"),
  entry("BA", "Bosnia and Herzegovina", "البوسنة والهرسك", "EUROPE"),
  entry("AL", "Albania", "ألبانيا", "EUROPE"),
  entry("MK", "North Macedonia", "مقدونيا الشمالية", "EUROPE"),
  entry("ME", "Montenegro", "الجبل الأسود", "EUROPE"),
  // Americas
  entry("US", "United States", "الولايات المتحدة", "AMERICAS"),
  entry("CA", "Canada", "كندا", "AMERICAS"),
  entry("MX", "Mexico", "المكسيك", "AMERICAS"),
  entry("BR", "Brazil", "البرازيل", "AMERICAS"),
  entry("AR", "Argentina", "الأرجنتين", "AMERICAS"),
  entry("CL", "Chile", "تشيلي", "AMERICAS"),
  entry("CO", "Colombia", "كولومبيا", "AMERICAS"),
  entry("PE", "Peru", "بيرو", "AMERICAS"),
  entry("VE", "Venezuela", "فنزويلا", "AMERICAS"),
  entry("EC", "Ecuador", "الإكوادور", "AMERICAS"),
  entry("UY", "Uruguay", "الأوروغواي", "AMERICAS"),
  entry("PY", "Paraguay", "الباراغواي", "AMERICAS"),
  entry("BO", "Bolivia", "بوليفيا", "AMERICAS"),
  entry("CU", "Cuba", "كوبا", "AMERICAS"),
  entry("DO", "Dominican Republic", "جمهورية الدومينيكان", "AMERICAS"),
  entry("JM", "Jamaica", "جامايكا", "AMERICAS"),
  // Oceania
  entry("AU", "Australia", "أستراليا", "OCEANIA"),
  entry("NZ", "New Zealand", "نيوزيلندا", "OCEANIA"),
  entry("FJ", "Fiji", "فيجي", "OCEANIA"),
  entry("PG", "Papua New Guinea", "بابوا غينيا الجديدة", "OCEANIA"),
];

const byCode = new Map(NATIONALITY_CATALOG.map((entry) => [entry.code, entry]));

export function isNationalityCode(value: unknown): value is string {
  return typeof value === "string" && byCode.has(value);
}

export function nationalityLabel(code: string, locale: "en" | "ar"): string | null {
  const found = byCode.get(code);
  return found ? (locale === "ar" ? found.nameAr : found.nameEn) : null;
}

export function searchNationalities(query: string, locale: "en" | "ar"): NationalityEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...NATIONALITY_CATALOG];
  return NATIONALITY_CATALOG.filter((entry) =>
    entry.code.toLowerCase().includes(q)
    || entry.nameEn.toLowerCase().includes(q)
    || entry.nameAr.includes(q)
    || (locale === "ar" ? entry.nameAr : entry.nameEn).toLowerCase().includes(q));
}
