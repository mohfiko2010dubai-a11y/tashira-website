import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Globe2, Home, Plane, UserRound, UsersRound, Zap, Clock3, Check } from "lucide-react";
import WizardShell, { StepHeader, WizardNav } from "@/components/customer/WizardShell";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const visaRoutes = [
  ["14days-single", "14 Days Visa"], ["14days-multiple", "14 Days Multiple Entry"],
  ["30days-single", "30 Days Visa"], ["30days-multiple", "30 Days Multiple Entry"],
  ["60days-single", "60 Days Visa"], ["60days-multiple", "60 Days Multiple Entry"],
  ["90days-single", "90 Days Visa"], ["96hours-transit", "96 Hours Transit"],
] as const;

type ResidenceType = "non-gcc" | "gcc-resident" | "non-gcc-accompany" | "gcc-accompany";

const residenceOptions: { key: ResidenceType; icon: typeof Home; title: string; desc: string }[] = [
  { key: "non-gcc", icon: Globe2, title: "Non-GCC Resident", desc: "I live outside the GCC countries" },
  { key: "gcc-resident", icon: Building2, title: "GCC Resident", desc: "I hold a valid GCC residence permit" },
  { key: "non-gcc-accompany", icon: UserRound, title: "Non-GCC Accompanying", desc: "Travelling with a GCC-national sponsor" },
  { key: "gcc-accompany", icon: UsersRound, title: "GCC Resident Accompanying", desc: "GCC resident travelling with a sponsor" },
];

const processingOptions = [
  { key: "regular" as const, icon: Clock3, title: "Regular", desc: "Standard processing — 24 to 48 hours" },
  { key: "express" as const, icon: Zap, title: "Express", desc: "Priority processing — as fast as 6 hours" },
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
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all ${
        selected
          ? "border-[#C9A04C] bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 shadow-sm"
          : "border-gray-200 hover:border-[#DDBB7A]"
      }`}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A04C] text-white">
          <Check size={12} />
        </span>
      )}
      {Icon && (
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? "bg-[#C9A04C] text-white" : "bg-gray-100 text-gray-400"}`}>
          <Icon size={22} />
        </span>
      )}
      <strong className="text-[#0A1628]">{title}</strong>
      {desc && <span className="text-sm text-gray-500">{desc}</span>}
    </button>
  );
}

export default function DynamicApplicationStart() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 Travel, 2 Residence, 3 Visa Type, 4 Processing
  const [applicationType, setApplicationType] = useState<"single" | "family">("single");
  const [applicantCount, setApplicantCount] = useState(2);
  const [residenceType, setResidenceType] = useState<ResidenceType>("non-gcc");
  const [visaType, setVisaType] = useState<string>(visaRoutes[2][0]);
  const [processingType, setProcessingType] = useState<"regular" | "express">("regular");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [accepted, setAccepted] = useState(false);

  const applicants = useMemo(
    () => Array.from({ length: applicationType === "single" ? 1 : applicantCount }, (_, index) => ({
      fullName: `Applicant ${index + 1}`,
    })),
    [applicationType, applicantCount],
  );

  const create = trpc.application.create.useMutation({
    onSuccess: ({ referenceNumber }) => navigate(`/apply/${encodeURIComponent(referenceNumber)}/interview`, { replace: true }),
  });

  const stepValid =
    step === 1 ? (applicationType === "single" || applicantCount >= 2)
    : step === 2 ? Boolean(residenceType)
    : step === 3 ? Boolean(visaType)
    : Boolean(email && phone && accepted);

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
    <WizardShell currentStep={step}>
      {step === 1 && (
        <section>
          <StepHeader step={1} title="Who is travelling?" subtitle="Every traveller gets their own questions and document checklist." />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectCard
              icon={UserRound}
              selected={applicationType === "single"}
              onClick={() => setApplicationType("single")}
              title="Single applicant"
              desc="One traveller"
            />
            <SelectCard
              icon={UsersRound}
              selected={applicationType === "family"}
              onClick={() => setApplicationType("family")}
              title="Family / group"
              desc="Separate questions and documents per traveller"
            />
          </div>
          {applicationType === "family" && (
            <label className="mt-6 block text-sm font-medium text-[#0A1628]">
              Number of travellers
              <input
                type="number"
                min={2}
                max={10}
                value={applicantCount}
                onChange={(event) => setApplicantCount(Math.min(10, Math.max(2, Number(event.target.value))))}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none"
              />
            </label>
          )}
          <WizardNav onNext={() => setStep(2)} nextDisabled={!stepValid} />
        </section>
      )}

      {step === 2 && (
        <section>
          <StepHeader step={2} title="Residence status" subtitle="Your residence status defines which visa rules and documents apply to you." />
          <div className="grid gap-4 sm:grid-cols-2">
            {residenceOptions.map((opt) => (
              <SelectCard
                key={opt.key}
                icon={opt.icon}
                selected={residenceType === opt.key}
                onClick={() => setResidenceType(opt.key)}
                title={opt.title}
                desc={opt.desc}
              />
            ))}
          </div>
          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!stepValid} />
        </section>
      )}

      {step === 3 && (
        <section>
          <StepHeader step={3} title="Choose your visa" subtitle="Select the visa duration and entry type that matches your trip." />
          <div className="grid gap-3 sm:grid-cols-2">
            {visaRoutes.map(([value, label]) => (
              <SelectCard
                key={value}
                icon={Plane}
                selected={visaType === value}
                onClick={() => setVisaType(value)}
                title={label}
              />
            ))}
          </div>
          <WizardNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!stepValid} />
        </section>
      )}

      {step === 4 && (
        <section>
          <StepHeader step={4} title="Processing & contact" subtitle="Choose your processing speed and where we send your visa." />
          <div className="grid gap-4 sm:grid-cols-2">
            {processingOptions.map((opt) => (
              <SelectCard
                key={opt.key}
                icon={opt.icon}
                selected={processingType === opt.key}
                onClick={() => setProcessingType(opt.key)}
                title={opt.title}
                desc={opt.desc}
              />
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#0A1628]">
              Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
            </label>
            <label className="text-sm font-medium text-[#0A1628]">
              Mobile number
              <input required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
            </label>
            <label className="text-sm font-medium text-[#0A1628] sm:col-span-2">
              Planned arrival date <span className="text-gray-400">(optional)</span>
              <input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[#C9A04C] focus:outline-none" />
            </label>
          </div>
          <label className="mt-6 flex items-start gap-3 text-sm text-gray-600">
            <input required type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 accent-[#C9A04C]" />
            <span>
              I agree to the <Link className="text-[#C9A04C] underline" to="/terms" target="_blank">Terms</Link>,{" "}
              <Link className="text-[#C9A04C] underline" to="/privacy" target="_blank">Privacy Policy</Link> and{" "}
              <Link className="text-[#C9A04C] underline" to="/refund" target="_blank">Refund/Cancellation Policy</Link>.
            </span>
          </label>
          {create.error && (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
              We couldn't start your application. Please check the details and try again.
            </p>
          )}
          <WizardNav onBack={() => setStep(3)} onNext={submit} nextDisabled={!stepValid} busy={create.isPending} nextLabel="Start my application →" />
          <p className="mt-4 text-center text-xs text-gray-400">
            Your nationality and personal details come next — the interview adapts per traveller and shows only the documents your visa rules require.
          </p>
        </section>
      )}
    </WizardShell>
  );
}
