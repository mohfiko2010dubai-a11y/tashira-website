import ChunkLoadErrorBoundary from "./ChunkLoadErrorBoundary";
import { importWithStaleChunkRecovery } from "@/lib/lazy-import";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, X } from "lucide-react";
import { ASSISTANT_GUIDANCE, assistantApplicationPath, assistantDocuments, assistantReference } from "@contracts/assistant-guidance";
import { GCC_COUNTRIES, type TripPurpose } from "@contracts/document-requirement-engine";
import { VISA_ROUTES } from "@contracts/visa-options";
import { customerMoney } from "@contracts/customer-money";
import { languagePath } from "@contracts/language-routes";
import { parseChatbotResumeMetadata } from "@/lib/chatbot-application";
import { useProcessingQuotes } from "@/hooks/useProcessingQuotes";
import NationalitySelect from "@/components/customer/NationalitySelect";

const AssistantApplication = lazy(() => importWithStaleChunkRecovery(() => import("./AssistantApplication")));

type Topic = keyof typeof ASSISTANT_GUIDANCE.en;
const subscribeResume = (notify: () => void) => { window.addEventListener("storage", notify); return () => window.removeEventListener("storage", notify); };
const readResume = () => { try { return assistantReference(localStorage.getItem("tashira_assistant_reference")) ?? parseChatbotResumeMetadata(localStorage.getItem("tashira_chatbot_resume"))?.referenceNumber; } catch { return undefined; } };
const serverResume = () => undefined;

function AssistantPanel({ close }: { close: () => void }) {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith("ar") ? "ar" : "en";
  const ar = language === "ar";
  const location = useLocation();
  const [applicationPath, setApplicationPath] = useState<string>();
  const [inApplication, setInApplication] = useState(false);
  const [topic, setTopic] = useState<Topic>("steps");
  const [nationality, setNationality] = useState("");
  const [country, setCountry] = useState("");
  const [residenceType, setResidenceType] = useState("non-gcc");
  const [purpose, setPurpose] = useState<TripPurpose>("tourism");
  const [visa, setVisa] = useState<string>("30days-single");
  const [count, setCount] = useState(1);
  const resume = useSyncExternalStore(subscribeResume, readResume, serverResume);
  const heading = useRef<HTMLHeadingElement>(null);
  const quotes = useProcessingQuotes(visa, count);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const currentReference = /\/apply\/(TSH-[A-Z0-9-]+)\/interview/i.exec(location.pathname)?.[1];
  const reference = currentReference ?? resume;
  const documents = nationality && country ? assistantDocuments({ nationality, country_of_residence: country,
    residence_type: residenceType, visa_type: visa, trip_purpose: /transit|96hours/i.test(visa) ? "transit" : purpose }) : [];
  const topics: [Topic, string][] = [["steps", ar ? "خطوات التقديم" : "Application steps"], ["family", ar ? "طلب عائلي" : "Family application"],
    ["documents", ar ? "المستندات والأسعار" : "Documents & prices"], ["passport", ar ? "بيانات الجواز" : "Passport details"],
    ["uploads", ar ? "رفع الملفات" : "Uploading files"], ["payment", ar ? "الدفع" : "Payment"]];
  const field = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm";
  return <section id="tashira-assistant" role="dialog" aria-modal="false" aria-labelledby="assistant-heading" dir={ar ? "rtl" : "ltr"}
    onKeyDown={event => { if (event.key === "Escape") close(); }}
    className="fixed bottom-24 end-3 z-50 flex max-h-[calc(100dvh-7rem)] w-[min(640px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-start shadow-2xl">
    <header className="flex items-center justify-between bg-[#0A1628] px-4 py-3 text-white">
      <h2 id="assistant-heading" ref={heading} tabIndex={-1} className="font-semibold outline-none">{ar ? "مساعد تأشيرة" : "TASHIRA Assistant"}</h2>
      <button type="button" onClick={close} aria-label={ar ? "إغلاق المساعد" : "Close assistant"} className="min-h-11 min-w-11"><X className="mx-auto" size={20} /></button>
    </header>
    {applicationPath && <div hidden={!inApplication} className="overflow-y-auto">
      <button type="button" onClick={() => setInApplication(false)} className="min-h-11 px-4 text-sm underline">{ar ? "الرجوع لإرشادات المساعد" : "Back to assistant guidance"}</button>
      <ChunkLoadErrorBoundary><Suspense fallback={<p role="status" className="p-4">{ar ? "جارٍ فتح نموذج التقديم…" : "Opening application…"}</p>}><AssistantApplication initialPath={applicationPath} /></Suspense></ChunkLoadErrorBoundary>
    </div>}
    <div hidden={inApplication} className="overflow-y-auto p-4">
      <p className="text-sm text-slate-600">{ar ? "أرشدك حسب قواعد نموذج التقديم الحالي. إدخال البيانات ورفع الملفات والدفع داخل نفس النموذج الآمن." : "Guidance from the current application rules. Enter details, upload files and pay in the same secure application."}</p>
      <div className="my-4 grid grid-cols-2 gap-2">{topics.map(([key, label]) => <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)} className={`min-h-11 rounded-lg border p-2 text-sm ${topic === key ? "border-[#C9A04C] bg-amber-50" : "border-slate-200"}`}>{label}</button>)}</div>
      <p role="status" aria-live="polite" className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed">{ASSISTANT_GUIDANCE[language][topic]}</p>
      {topic === "documents" && <div className="mt-4 space-y-3">
        <label className="block text-sm">{ar ? "نوع التأشيرة" : "Visa type"}<select className={field} value={visa} onChange={event => setVisa(event.target.value)}>{VISA_ROUTES.map(([code, label]) => <option key={code} value={code}>{ar ? code.replace("days-single", " يوم — دخول واحد").replace("days-multiple", " يوم — دخول متعدد").replace("96hours-transit", "96 ساعة — ترانزيت") : label}</option>)}</select></label>
        <label className="block text-sm">{ar ? "عدد المسافرين" : "Travellers"}<select className={field} value={count} onChange={event => setCount(Number(event.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label>
        <div role="status" className="rounded-lg border border-[#C9A04C] p-3 text-sm">
          {quotes.loading ? ar ? "جارٍ جلب السعر الحالي…" : "Loading current price…" : quotes.failed ? <><p>{ar ? "تعذر جلب السعر. أعد المحاولة." : "Could not load the price. Please retry."}</p><button type="button" className="min-h-11 underline" onClick={quotes.retry}>{ar ? "إعادة المحاولة" : "Retry"}</button></> : <>
            <p>{ar ? "الإجمالي العادي: " : "Regular total: "}{customerMoney(quotes.regular!.totalPrice, language)}</p>
            <p>{ar ? "فرق Express لكل مسافر: " : "Express extra per traveller: "}{customerMoney(quotes.unitDelta!, language)}</p>
            <p>{ar ? "إجمالي Express: " : "Express total: "}{customerMoney(quotes.express!.totalPrice, language)}</p>
          </>}
        </div>
        <label className="block text-sm">{ar ? "نوع الإقامة" : "Residence type"}<select className={field} value={residenceType} onChange={event => { setResidenceType(event.target.value); setCountry(""); }}>
          <option value="non-gcc">{ar ? "مقيم خارج الخليج" : "Non-GCC Resident"}</option><option value="gcc-resident">{ar ? "مقيم خليجي" : "GCC Resident"}</option><option value="gcc-accompany">{ar ? "مرافق مقيم خليجي" : "GCC Resident Accompanying"}</option>
        </select></label>
        <NationalitySelect value={nationality} onChange={setNationality} compact />
        <NationalitySelect value={country} onChange={setCountry} purpose="residence" compact allowedCodes={residenceType === "non-gcc" ? undefined : GCC_COUNTRIES} />
        <p className="text-xs text-slate-500">{ar ? "بلد الإقامة هو البلد الذي تعيش فيه، وليس جنسيتك." : "Country of residence is where you currently live, not your citizenship."}</p>
        <label className="block text-sm">{ar ? "غرض الرحلة" : "Trip purpose"}<select className={field} value={purpose} onChange={event => setPurpose(event.target.value as TripPurpose)}><option value="tourism">{ar ? "سياحة" : "Tourism"}</option><option value="visiting_family">{ar ? "زيارة عائلة" : "Visiting family"}</option><option value="transit">{ar ? "ترانزيت" : "Transit"}</option></select></label>
        <div aria-live="polite">{documents.length > 0 ? <><h3 className="font-semibold">{ar ? `المستندات المطلوبة لهذا المسافر: ${documents.length}` : `Required documents for this traveller: ${documents.length}`}</h3>
          <p className="mt-1 text-xs text-slate-500">{ar ? "راجع القائمة لكل جنسية في الطلب العائلي." : "Check each nationality in a family application."}</p>
          <ul className="mt-2 space-y-3">{documents.map(doc => <li key={doc.key} data-assistant-document={doc.code} className="rounded-lg border p-3 text-sm"><strong>{ar ? doc.label_ar : doc.label_en}</strong><p className="mt-1 text-xs text-slate-600">{ar ? doc.hint_ar : doc.hint_en}</p>
            {doc.any_of && <p className="mt-1 text-xs">{doc.any_of.map(child => ar ? child.label_ar : child.label_en).join(ar ? " أو " : " OR ")}</p>}
          </li>)}</ul></> : <p className="text-sm text-slate-500">{ar ? "اختر الجنسية وبلد الإقامة لعرض المستندات." : "Select nationality and residence to see the documents."}</p>}</div>
      </div>}
      <p className="mt-4 text-xs text-slate-500">{ar ? "هذا إرشاد للمستندات وليس موافقة على التأشيرة." : "This is document guidance, not visa approval."}</p>
      <button type="button" onClick={() => { setApplicationPath(current => current ?? assistantApplicationPath(language, reference, { nationality, country_of_residence: country, residence_type: residenceType, visa_type: visa, trip_purpose: purpose, applicantCount: count })); setInApplication(true); }} className="mt-4 block w-full rounded-xl bg-[#0A1628] p-3 text-center font-semibold text-white">{applicationPath || reference ? ar ? "استكمال التقديم داخل المحادثة" : "Continue application in chat" : ar ? "ابدأ التقديم داخل المحادثة" : "Start application in chat"}</button>
      <Link onClick={close} to={languagePath("/track", language)} className="mt-3 block text-center text-sm underline">{ar ? "استعادة أو متابعة طلب آخر" : "Recover or track another application"}</Link>
      <a href="https://wa.me/971589896644" target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-sm text-emerald-700 underline">{ar ? "تواصل مع الفريق على واتساب" : "Contact the team on WhatsApp"}</a>
    </div>
  </section>;
}

export default function ChatBot() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get("resume") === "1");
  const [hasOpened, setHasOpened] = useState(open);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  return <>
    <button ref={toggle} type="button" aria-expanded={open} aria-controls="tashira-assistant" aria-label={i18n.language.startsWith("ar") ? "مساعد تأشيرة" : "TASHIRA Assistant"}
      onClick={() => { setHasOpened(true); setOpen(value => !value); }} className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white shadow-lg">{open ? <X size={24} /> : <MessageCircle size={24} />}</button>
    <div hidden={!open}>{hasOpened && <AssistantPanel close={close} />}</div>
  </>;
}
