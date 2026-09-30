import { trpc } from "@/providers/trpc-client";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import type { DocumentRequirementContext } from "@contracts/document-requirement-engine";
import CustomerPrecheckResult from "@/components/customer/CustomerPrecheckResult";
import NationalitySelect from "@/components/customer/NationalitySelect";
import { useValidationFeedback } from "@/components/customer/useValidationFeedback";

const routes = [
  ["14days-single", "14 Days Visa"], ["14days-multiple", "14 Days Multiple Entry"], ["30days-single", "30 Days Visa"], ["30days-multiple", "30 Days Multiple Entry"],
  ["60days-single", "60 Days Visa"], ["60days-multiple", "60 Days Multiple Entry"], ["90days-single", "90 Days Visa"], ["96hours-transit", "96 Hours Transit"],
] as const;

export default function CustomerPrecheck() {
  const { i18n, t } = useTranslation("pricing");
  const copy = (en: string, ar: string) => i18n.language.startsWith("ar") ? ar : en;
  const catalog = trpc.catalog.listActiveProducts.useQuery();
  const [routeCode, setRouteCode] = useState<string>(routes[0][0]);
  const [nationality, setNationality] = useState("");
  const [residenceCountry, setResidenceCountry] = useState("");
  const [context, setContext] = useState<DocumentRequirementContext | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const feedback = useValidationFeedback({
    visa: !catalog.data?.some(product => product.id === routeCode) ? copy("Choose an available visa service.", "اختر خدمة تأشيرة متاحة.") : undefined,
    nationality: !nationality ? copy("Choose your nationality from the country list.", "اختر جنسيتك من قائمة الدول.") : undefined,
    residence: !residenceCountry ? copy("Choose the country where you currently live.", "اختر البلد الذي تقيم فيه حاليًا.") : undefined,
  });
  const changed = () => setContext(null);
  return <main className="mx-auto min-h-[70vh] max-w-6xl px-4 pb-12 pt-32">
    <div className="grid items-start gap-8 min-[900px]:grid-cols-[1fr_1fr]">
      <section className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#b58a32]">{copy("Visa guidance", "إرشادات التأشيرة")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{copy("Check your likely visa requirements", "تحقّق من متطلبات تأشيرتك المحتملة")}</h1>
        <p className="mt-3 text-slate-600">{copy("Answer a few non-sensitive questions. This check is guidance only and never replaces official review.", "أجب عن بعض الأسئلة غير الحساسة. هذا الفحص إرشادي فقط ولا يحل محل المراجعة الرسمية.")}</p>
        <form noValidate className="mt-7 space-y-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-6" onSubmit={event => {
          event.preventDefault();
          if (!feedback.validate(event.currentTarget)) return;
          setContext({ nationality, country_of_residence: residenceCountry, visa_type: routeCode, trip_purpose: /transit|96hours/i.test(routeCode) ? "transit" : "tourism" });
          requestAnimationFrame(() => { resultRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); resultRef.current?.focus({ preventScroll: true }); });
        }}>
          <div><p className="mb-2 text-sm font-medium">{copy("Nationality", "الجنسية")}</p>
            <NationalitySelect {...feedback.fieldProps("nationality")} compact value={nationality} onChange={code => { setNationality(code); changed(); }} />{feedback.errorFor("nationality")}</div>
          <div><p className="mb-2 text-sm font-medium">{copy("Country of residence", "بلد الإقامة")}</p>
            <NationalitySelect {...feedback.fieldProps("residence", "precheck-residence-help")} compact purpose="residence" value={residenceCountry} onChange={code => { setResidenceCountry(code); changed(); }} />
            <p id="precheck-residence-help" className="mt-2 text-xs text-slate-500">{copy("The country you currently live in — not your country of citizenship.", "البلد الذي تقيم فيه حاليًا — وليس بلد جنسيتك.")}</p>{feedback.errorFor("residence")}</div>
          <label className="block text-sm font-medium">{copy("Visa service", "خدمة التأشيرة")}<select {...feedback.fieldProps("visa")} value={routeCode} onChange={event => { setRouteCode(event.target.value); changed(); }} className="mt-2 min-h-11 w-full rounded-xl border px-3 py-2">{routes.filter(([value]) => catalog.data?.some(product => product.id === value)).map(([value, label]) => <option key={value} value={value}>{i18n.language.startsWith("ar") ? t(`visaTypes.${value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`) : label}</option>)}</select>{feedback.errorFor("visa")}</label>
          <p className="text-sm text-slate-600">{copy("Trip purpose:", "غرض الرحلة:")} {/transit|96hours/i.test(routeCode) ? copy("Transit", "عبور") : copy("Tourism", "سياحة")}</p>
          <p aria-live="polite" className="text-sm text-red-700">{feedback.count > 0 && copy(`${feedback.count} fields need attention. Choose the missing countries above.`, `${feedback.count} حقول تحتاج مراجعة. اختر الدول الناقصة أعلاه.`)}</p>
          <button type="submit" className="w-full rounded-xl bg-[#0A1628] px-5 py-3 font-semibold text-white">{copy("Check requirements", "تحقّق من المتطلبات")}</button>
        </form>
      </section>
      <div ref={resultRef} tabIndex={-1} aria-label={copy("Your document checklist", "قائمة مستنداتك")} className="min-w-0 min-[900px]:sticky min-[900px]:top-[calc(var(--site-header-height)+1rem)]"><CustomerPrecheckResult context={context} /></div>
    </div>
  </main>;
}
