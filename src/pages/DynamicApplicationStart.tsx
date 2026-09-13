import { precheckPrefill } from "@/lib/precheck-documents";
import NationalitySelect from "@/components/customer/NationalitySelect";
import { GCC_COUNTRIES, requiredDocuments, tripPurposeSchema, type TripPurpose } from "@contracts/document-requirement-engine";
import { useProcessingQuotes } from "@/hooks/useProcessingQuotes";
import { useMemo, useState } from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import { Home, Plane, UserRound, UsersRound, Zap, Clock3, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import WizardShell, { StepHeader } from "@/components/customer/WizardShell";
import { validStartContact, validStartEmail, validStartPhone } from "@/lib/wizard-validation";
import { useValidationFeedback } from "@/components/customer/useValidationFeedback";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const visaRoutes = [
  ["14days-single", "14 Days Visa"], ["14days-multiple", "14 Days Multiple Entry"],
  ["30days-single", "30 Days Visa"], ["30days-multiple", "30 Days Multiple Entry"],
  ["60days-single", "60 Days Visa"], ["60days-multiple", "60 Days Multiple Entry"],
  ["90days-single", "90 Days Visa"], ["96hours-transit", "96 Hours Transit"],
] as const;

const processingOptions = [
  { key: "regular" as const, icon: Clock3, titleKey: "regular", descKey: "regularDesc" },
  { key: "express" as const, icon: Zap, titleKey: "express", descKey: "expressDesc" },
];

function createReference(): string {
  return `TSH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function SelectCard({ selected, onClick, title, desc, disabled = false, icon: Icon }: {
  selected: boolean; disabled?: boolean; onClick: () => void; title: string; desc?: string; icon?: typeof Home;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${
        selected
          ? "border-[#C9A04C] bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 shadow-sm"
          : "border-gray-200 hover:border-[#DDBB7A]"
      }`}
    >
      {selected && (
        <span className="absolute top-3 end-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A04C] text-white">
          <Check size={12} />
        </span>
      )}
      {Icon && (
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-[#C9A04C] text-white" : "bg-gray-100 text-gray-400"}`}>
          <Icon size={20} />
        </span>
      )}
      <strong className="text-sm text-[#0A1628]">{title}</strong>
      {desc && <span className="text-xs text-gray-500">{desc}</span>}
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 mt-8 text-base font-extrabold text-[#0A1628] first:mt-0">{children}</h2>;
}

export default function DynamicApplicationStart() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("wizard");
  const [searchParams] = useSearchParams();
  const prefill = precheckPrefill(searchParams);
  const visaParam = searchParams.get("visa") ?? "";
  const visaPrefill: Record<string, string> = {
    "14-days": "14days-single", "30-days": "30days-single", "60-days": "60days-single",
    "multiple-entry": "30days-multiple", "transit": "96hours-transit",
  };
  const [applicationType, setApplicationType] = useState<"single" | "family">(visaParam === "family" ? "family" : "single");
  const [residenceType, setResidenceType] = useState<"non-gcc" | "gcc-resident" | "gcc-accompany">(prefill.residenceType);
  const [nationality, setNationality] = useState(prefill.nationality);
  const [country, setCountry] = useState(prefill.country);
  const [purpose, setPurpose] = useState<TripPurpose>(prefill.purpose);
  const [applicantCount, setApplicantCount] = useState(2);
  const knownVisaId = visaRoutes.find(([v]) => v === visaParam)?.[0];
  const [visaType, setVisaType] = useState<string>(knownVisaId ?? visaPrefill[visaParam] ?? visaRoutes[2][0]);
  const processingParam = searchParams.get("processing") ?? "";
  const [processingType, setProcessingType] = useState<"regular" | "express">(processingParam === "express" ? "express" : "regular");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");

  const travellerCount = applicationType === "single" ? 1 : applicantCount;
  const applicants = useMemo(
    () => Array.from({ length: travellerCount }, (_, index) => ({ fullName: `Applicant ${index + 1}`, gccResidenceCountry: country, ...(applicationType === "single" ? { nationality, tripPurpose: /transit|96hours/i.test(visaType) ? "transit" as const : purpose } : {}) })),
    [travellerCount, country, applicationType, nationality, purpose, visaType],
  );

  // Live, authoritative server-side quote — the customer sees the exact
  // price (same pricing engine the payment uses) before starting.
  const prices = useProcessingQuotes(visaType, travellerCount);
  const quote = { data: prices[processingType], isPending: prices.loading };
  const money = (amount: number) => new Intl.NumberFormat(i18n.language, { style: "currency", currency: prices.regular?.currency ?? "USD", maximumFractionDigits: 2 }).format(amount);


  const create = trpc.application.create.useMutation({
    onSuccess: ({ referenceNumber }) => navigate(`/apply/${encodeURIComponent(referenceNumber)}/interview`, { replace: true }),
  });

  const stepValid = Boolean(country && (applicationType === "family" || nationality) && validStartContact(email, phone) && Number.isInteger(travellerCount) && travellerCount >= 1 && travellerCount <= 10 && visaType && processingType);

  const documentRules = requiredDocuments({ nationality: applicationType === "single" ? nationality : undefined,
    country_of_residence: country, visa_type: visaType, trip_purpose: /transit|96hours/i.test(visaType) ? "transit" : purpose });
  const ar = i18n.language.startsWith("ar");
  const countryCatalog = trpc.dynamicInterview.nationalityCatalog.useQuery({});
  const allowedResidence = countryCatalog.data?.nationalities.filter(item => residenceType === "non-gcc"
    ? !GCC_COUNTRIES.some(code => code === item.code) : GCC_COUNTRIES.some(code => code === item.code)).map(item => item.code);
  const feedback = useValidationFeedback({
    nationality: applicationType === "single" && !nationality ? t("validation.choose", { field: t("simple.fields.NATIONALITY") }) : undefined,
    residence: !country ? t("validation.choose", { field: t("simple.fields.RESIDENCE_COUNTRY") }) : undefined,
    email: !email.trim() ? t("validation.emailRequired") : !validStartEmail(email) ? t("validation.emailInvalid") : undefined,
    phone: !validStartPhone(phone) ? t("validation.phone") : undefined,
    applicantCount: !Number.isInteger(travellerCount) || travellerCount < 1 || travellerCount > 10 ? t("validation.count") : undefined,
    visaType: !visaType ? t("validation.choose", { field: t("step1.visaType") }) : undefined,
    processingType: !processingType ? t("validation.choose", { field: t("step1.processing") }) : undefined,
  });

  const submit = (form: HTMLFormElement) => {
    if (!feedback.validate(form)) return;
    if (!stepValid || !validStartContact(email, phone)) return;
    if (create.isPending || !quote.data) return;
    create.mutate({
      referenceNumber: createReference(),
      baseType: applicationType,
      residenceType,
      visaType,
      processingType,
      contactEmail: email.trim(),
      contactPhone: phone.trim(),
      journeyMode: "DYNAMIC",
      ...(arrivalDate ? { arrivalDate } : {}),
      policyVersion: TERMS_POLICY_VERSION,
      applicants,
    });
  };

  return (
    <WizardShell currentStep={1}>
      <form noValidate onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }}>
        {(
          <>
            <StepHeader step={1} title={t("step1.title")} subtitle={t("step1.subtitle")} />
            <SectionTitle>{t("step1.whoTravelling")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectCard icon={UserRound} selected={applicationType === "single"} onClick={() => setApplicationType("single")}
                title={t("step1.single")} desc={t("step1.singleDesc")} />
              <SelectCard icon={UsersRound} selected={applicationType === "family"} onClick={() => setApplicationType("family")}
                title={t("step1.family")} desc={t("step1.familyDesc")} />
            </div>
            {applicationType === "family" && (
              <label className="mt-4 block text-sm font-medium text-[#0A1628]">
                {t("step1.count")}
                <input {...feedback.fieldProps("applicantCount")} type="number" min={2} max={10} value={applicantCount}
                  onChange={(event) => setApplicantCount(Math.min(10, Math.max(2, Number(event.target.value))))}
                  className="mt-2 w-32 rounded-xl border border-gray-300 aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
              {feedback.errorFor("applicantCount")}
              </label>
            )}

            <SectionTitle>{ar ? "نوع الإقامة" : "Residence type"}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">{(["non-gcc", "gcc-resident", "gcc-accompany"] as const).map(type => <SelectCard key={type}
              selected={residenceType === type} onClick={() => { setResidenceType(type); if ((residenceType === "non-gcc") !== (type === "non-gcc")) setCountry(""); }}
              title={type === "non-gcc" ? (ar ? "مقيم خارج دول الخليج" : "Non-GCC Resident") : type === "gcc-resident" ? (ar ? "مقيم في دول الخليج" : "GCC Resident") : (ar ? "مرافق مقيم خليجي" : "GCC Resident Accompanying")} />)}</div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {applicationType === "single" && <div><p className="mb-2 text-sm font-medium">{t("simple.fields.NATIONALITY")} *</p>
                <NationalitySelect {...feedback.fieldProps("nationality")} compact value={nationality} onChange={setNationality} />{feedback.errorFor("nationality")}</div>}
              <div><p className="mb-2 text-sm font-medium">{t("simple.fields.RESIDENCE_COUNTRY")} *</p>
                <NationalitySelect {...feedback.fieldProps("residence", "start-residence-help")} compact purpose="residence" value={country} onChange={setCountry} allowedCodes={allowedResidence ?? []} />
                <p id="start-residence-help" className="mt-2 text-xs text-slate-500">{t("simple.residenceHint")}</p>{feedback.errorFor("residence")}</div>
              {applicationType === "single" && !/transit|96hours/i.test(visaType) && <label className="grid gap-2 text-sm font-medium">{t("simple.tripPurpose")}
                <select className="min-h-11 rounded-xl border p-3" value={purpose} onChange={event => setPurpose(tripPurposeSchema.parse(event.target.value))}>
                  <option value="tourism">{t("simple.purposeTourism")}</option><option value="visiting_family">{t("simple.purposeFamily")}</option><option value="transit">{t("simple.purposeTransit")}</option>
                </select></label>}
            </div>
            {country && (applicationType === "family" || nationality) && <section className="mt-5 rounded-xl border border-[#C9A04C] p-4" aria-live="polite">
              <h2 className="font-bold">{applicationType === "single" ? (ar ? `مستنداتك: ${documentRules.length} ملفات` : `Your documents: ${documentRules.length} files`) : (ar ? "مستندات الإقامة" : "Residence documents")}</h2>
              <ul className="mt-2 list-inside list-disc text-sm">{documentRules.filter(rule => applicationType === "single" || rule.applies_when.country_of_residence || rule.applies_when.residence_region).map(rule => <li key={rule.key}>{ar ? rule.label_ar : rule.label_en}</li>)}</ul>
              {applicationType === "family" && <p className="mt-2 text-sm">{ar ? "قد تُطلب مستندات إضافية حسب جنسية كل مسافر." : "Additional documents may apply based on nationality."}</p>}
            </section>}

            <SectionTitle>{t("step1.visaType")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visaRoutes.map(([value, label]) => (
                <SelectCard key={value} icon={Plane} selected={visaType === value} onClick={() => setVisaType(value)} title={i18n.language.startsWith("ar") ? t(`pricing:visaTypes.${value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`) : label} />
              ))}
            </div>
            {feedback.errorFor("visaType")}

            <SectionTitle>{t("step1.processing")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {processingOptions.map((opt) => (
                <SelectCard key={opt.key} icon={opt.icon} selected={processingType === opt.key}
                  disabled={!prices.express && opt.key === "express"} onClick={() => setProcessingType(opt.key)} title={`${t(`step1.${opt.titleKey}`)}${opt.key === "express" ? prices.unitDelta === undefined ? ` — ${t("step1.priceCalculating")}` : ` +${money(prices.unitDelta)}` : ""}`} desc={t(`step1.${opt.descKey}`)} />
              ))}
            </div>
            {feedback.errorFor("processingType")}

            <SectionTitle>{t("step1.contact")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#0A1628]">
                {t("step1.email")}
                <input {...feedback.fieldProps("email")} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-gray-300 aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
              {feedback.errorFor("email")}
              </label>
              <label className="text-sm font-medium text-[#0A1628]">
                {t("step1.phone")}
                <input {...feedback.fieldProps("phone")} required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel"
                  className="mt-2 w-full rounded-xl border border-gray-300 aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
              {feedback.errorFor("phone")}
              </label>
              <label className="text-sm font-medium text-[#0A1628] sm:col-span-2">
                {t("step1.arrival")} <span className="text-gray-400">({t("step1.optional")})</span>
                <input type="date" min={new Date().toISOString().slice(0, 10)} value={arrivalDate}
                  onChange={(event) => setArrivalDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
              </label>
            </div>

            {/* Price on screen before starting */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A04C]/30 bg-gradient-to-br from-[#C9A04C]/10 to-transparent p-5">
              <div>
                <p className="text-sm font-bold text-[#0A1628]">{t("step1.price")}</p>
                <p className="text-xs text-gray-500">
                  {quote.data
                    ? t("step1.pricePerTraveller", { price: money(quote.data.unitPrice) })
                    : t("step1.priceCalculating")}
                </p>
              </div>
              <div className="text-end">
                {quote.isPending && <Loader2 size={20} className="animate-spin text-[#C9A04C]" />}
                {quote.data && (
                  <>
                    <p className="text-3xl font-extrabold text-[#C9A04C]">{money(quote.data.totalPrice)}</p>
                    <p className="text-xs text-gray-500">{t("step1.priceTotal", { count: quote.data.applicantCount })}</p>
                  </>
                )}
              </div>
            {quote.data && prices.regular && <dl aria-live="polite" className="mt-3 w-full space-y-2 text-sm">
              <div className="flex justify-between"><dt>{t("step1.baseFare")} × {travellerCount}</dt><dd>{money(prices.regular.totalPrice)}</dd></div>
              {processingType === "express" && <div className="flex justify-between"><dt>{t("step1.expressExtra")} × {travellerCount}</dt><dd>+{money(prices.totalDelta!)}</dd></div>}
            </dl>}
            </div>
            {prices.failed && <div role="alert" className="mt-3 text-sm text-red-700"><p>{t("step1.quoteError")}</p><button type="button" onClick={prices.retry} className="underline">{t("step1.retryPrice")}</button></div>}

            {create.error && (
              <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{t("step1.startError")}</p>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-gray-500">{t("flow.startBeforeSave")}</p>
              <p aria-live="polite" aria-atomic="true" className="text-sm text-red-700">{feedback.count > 0 ? t("validation.summary", { count: feedback.count }) : ""}</p>
              <button type="submit" onMouseDown={event => event.preventDefault()} disabled={create.isPending || !quote.data}
                className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {t("step1.continue")}
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">{t("step1.nextNote")}</p>
          </>
        )}
      </form>
    </WizardShell>
  );
}
