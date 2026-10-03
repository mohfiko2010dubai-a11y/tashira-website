/** Business policy is supplied by the versioned settings, never the environment. */
export type DocumentValidityPolicy = {
  passportMonths: number;
  residenceMonths: number;
  childUnderYears: number;
};

export function isCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Clamp month ends rather than letting JavaScript roll February into March. */
export function addCalendarMonths(value: string, months: number): string {
  if (!isCalendarDate(value) || !Number.isInteger(months) || months < 0) throw new Error("Invalid date policy input");
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString().slice(0, 10);
}

export type ValidityFinding = {
  status: "UNKNOWN" | "BELOW" | "MEETS";
  expiry: string | null;
  requiredUntil: string | null;
  daysFromEntry: number | null;
};

function assessExpiry(expiry: string | null | undefined, entry: string | null, months: number): ValidityFinding {
  const requiredUntil = entry ? addCalendarMonths(entry, months) : null;
  const validExpiry = isCalendarDate(expiry) ? expiry : null;
  return {
    status: !validExpiry || !requiredUntil ? "UNKNOWN" : validExpiry < requiredUntil ? "BELOW" : "MEETS",
    expiry: validExpiry,
    requiredUntil,
    daysFromEntry: validExpiry && entry ? Math.round((Date.parse(validExpiry) - Date.parse(entry)) / 86400000) : null,
  };
}

/** Findings are evidence for human review, never a payment permission. */
export function assessDocumentValidity(input: {
  passportExpiry?: string | null;
  residenceExpiry?: string | null;
  dateOfBirth?: string | null;
  entryDate?: string | null;
  today: string;
}, policy: DocumentValidityPolicy) {
  if (!isCalendarDate(input.today) || [policy.passportMonths, policy.residenceMonths, policy.childUnderYears].some(value => !Number.isInteger(value) || value <= 0)) {
    throw new Error("Invalid document validity policy");
  }
  const entry = isCalendarDate(input.entryDate) ? input.entryDate : null;
  const questionWindowEnd = addCalendarMonths(input.today, 6);
  const needsTravelDate = !entry && [input.passportExpiry, input.residenceExpiry]
    .some(expiry => isCalendarDate(expiry) && expiry <= questionWindowEnd);
  const birth = isCalendarDate(input.dateOfBirth) ? input.dateOfBirth : null;
  // This is a prompt to verify a child, not a rate decision. Unknown travel date
  // must not suppress the prompt; expiry requirements still have no fallback.
  const ageReviewDate = entry ?? input.today;
  return {
    entryDate: entry,
    needsTravelDate,
    passport: assessExpiry(input.passportExpiry, entry, policy.passportMonths),
    residence: assessExpiry(input.residenceExpiry, entry, policy.residenceMonths),
    childReview: !birth || birth > ageReviewDate ? "UNKNOWN" as const
      : ageReviewDate < addCalendarMonths(birth, policy.childUnderYears * 12) ? "CONFIRM_CHILD_RATE" as const : "ADULT" as const,
  };
}

export const RESIDENCE_REVIEW_NOTICE = {
  en: "Based on the date you entered, your residence permit may not meet the requirement for this visa. You can continue — our team reviews your documents before filing. If the application cannot proceed, we refund your payment less the card processing fee.",
  ar: "حسب التاريخ الذي أدخلته، قد لا تستوفي إقامتك شرط هذه التأشيرة. يمكنك المتابعة — فريقنا يراجع مستنداتك قبل التقديم. وإذا تعذّر إكمال الطلب، نعيد لك المبلغ ناقص رسوم معالجة البطاقة.",
} as const;
