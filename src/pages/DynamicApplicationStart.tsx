import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Globe2, Home, Plane, UserRound, UsersRound, Zap, Clock3, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import WizardShell, { StepHeader } from "@/components/customer/WizardShell";
import { SaveContinueButton } from "@/components/customer/SaveContinueButton";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const visaRoutes = [
  ["14days-single", "14 Days Visa"], ["14days-multiple", "14 Days Multiple Entry"],
  ["30days-single", "30 Days Visa"], ["30days-multiple", "30 Days Multiple Entry"],
  ["60days-single", "60 Days Visa"], ["60days-multiple", "60 Days Multiple Entry"],
  ["90days-single", "90 Days Visa"], ["96hours-transit", "96 Hours Transit"],
] as const;

type ResidenceType = "non-gcc" | "gcc-resident" | "non-gcc-accompany" | "gcc-accompany";

const residenceOptions: { key: ResidenceType; icon: typeof Home; titleKey: string; descKey: string }[] = [
  { key: "non-gcc", icon: Globe2, titleKey: "residenceNonGcc", descKey: "residenceNonGccDesc" },
  { key: "gcc-resident", icon: Building2, titleKey: "residenceGcc", descKey: "residenceGccDesc" },
  { key: "non-gcc-accompany", icon: UserRound, titleKey: "residenceNonGccAcc", descKey: "residenceNonGccAccDesc" },
  { key: "gcc-accompany", icon: UsersRound, titleKey: "residenceGccAcc", descKey: "residenceGccAccDesc" },
];

const processingOptions = [
  { key: "regular" as const, icon: Clock3, titleKey: "regular", descKey: "regularDesc" },
  { key: "express" as const, icon: Zap, titleKey: "express", descKey: "expressDesc" },
];

function createReference(): string {
  return `TSH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function SelectCard({ selected, onClick, title, desc, icon: Icon }: {
  selected: boolean; onClick: () => void; title: string; desc?: string; icon?: typeof Home;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  const { t } = useTranslation("wizard");
  const [applicationType, setApplicationType] = useState<"single" | "family">("single");
  const [applicantCount, setApplicantCount] = useState(2);
  const [residenceType, setResidenceType] = useState<ResidenceType>("non-gcc");
  const [visaType, setVisaType] = useState<string>(visaRoutes[2][0]);
  const [processingType, setProcessingType] = useState<"regular" | "express">("regular");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");

  const travellerCount = applicationType === "single" ? 1 : applicantCount;
  const applicants = useMemo(
    () => Array.from({ length: travellerCount }, (_, index) => ({ fullName: `Applicant ${index + 1}` })),
    [travellerCount],
  );

  // Live, authoritative server-side quote — the customer sees the exact
  // price (same pricing engine the payment uses) before starting.
  const quote = trpc.wizard.quoteApplication.useMutation();
  useEffect(() => {
    const timer = setTimeout(() => {
      quote.mutate({ visaType, processingType, applicantCount: travellerCount });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaType, processingType, travellerCount]);

  const create = trpc.application.create.useMutation({
    onSuccess: ({ referenceNumber }) => navigate(`/apply/${encodeURIComponent(referenceNumber)}/interview`, { replace: true }),
  });

  const stepValid = Boolean(email && phone && (applicationType === "single" || applicantCount >= 2));

  const submit = () => {
    if (!stepValid || create.isPending) return;
    create.mutate({
      referenceNumber: createReference(),
      baseType: applicationType,
      residenceType,
      visaType,
      processingType,
      contactEmail: email,
      contactPhone: phone,
      journeyMode: "DYNAMIC",
      ...(arrivalDate ? { arrivalDate } : {}),
      policyVersion: TERMS_POLICY_VERSION,
      applicants,
    });
  };

  return (
    <WizardShell currentStep={1}>
      <section>
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
            <input type="number" min={2} max={10} value={applicantCount}
              onChange={(event) => setApplicantCount(Math.min(10, Math.max(2, Number(event.target.value))))}
              className="mt-2 w-32 rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
          </label>
        )}

        <SectionTitle>{t("step1.residence")}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {residenceOptions.map((opt) => (
            <SelectCard key={opt.key} icon={opt.icon} selected={residenceType === opt.key}
              onClick={() => setResidenceType(opt.key)} title={t(`step1.${opt.titleKey}`)} desc={t(`step1.${opt.descKey}`)} />
          ))}
        </div>

        <SectionTitle>{t("step1.visaType")}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visaRoutes.map(([value, label]) => (
            <SelectCard key={value} icon={Plane} selected={visaType === value} onClick={() => setVisaType(value)} title={label} />
          ))}
        </div>

        <SectionTitle>{t("step1.processing")}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {processingOptions.map((opt) => (
            <SelectCard key={opt.key} icon={opt.icon} selected={processingType === opt.key}
              onClick={() => setProcessingType(opt.key)} title={t(`step1.${opt.titleKey}`)} desc={t(`step1.${opt.descKey}`)} />
          ))}
        </div>

        <SectionTitle>{t("step1.contact")}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#0A1628]">
            {t("step1.email")}
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
          </label>
          <label className="text-sm font-medium text-[#0A1628]">
            {t("step1.phone")}
            <input required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
          </label>
          <label className="text-sm font-medium text-[#0A1628] sm:col-span-2">
            {t("step1.arrival")} <span className="text-gray-400">({t("step1.optional")})</span>
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={arrivalDate}
              onChange={(event) => setArrivalDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
          </label>
        </div>

        {/* Price on screen before starting */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9A04C]/30 bg-gradient-to-br from-[#C9A04C]/10 to-transparent p-5">
          <div>
            <p className="text-sm font-bold text-[#0A1628]">{t("step1.price")}</p>
            <p className="text-xs text-gray-500">
              {quote.data
                ? t("step1.pricePerTraveller", { price: `$${quote.data.unitPrice}` })
                : t("step1.priceCalculating")}
            </p>
          </div>
          <div className="text-end">
            {quote.isPending && <Loader2 size={20} className="animate-spin text-[#C9A04C]" />}
            {quote.data && (
              <>
                <p className="text-3xl font-extrabold text-[#C9A04C]">${quote.data.totalPrice}</p>
                <p className="text-xs text-gray-500">{t("step1.priceTotal", { count: quote.data.applicantCount })}</p>
              </>
            )}
          </div>
        </div>

        {create.error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{t("step1.startError")}</p>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <SaveContinueButton email={email || undefined} />
          <button type="button" onClick={submit} disabled={!stepValid || create.isPending}
            className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {create.isPending ? "…" : t("step1.start")}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">{t("step1.nextNote")}</p>
      </section>
    </WizardShell>
  );
}
