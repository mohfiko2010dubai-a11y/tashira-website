import OptionalFlightNotice from "./OptionalFlightNotice";
import { customerFileCount } from "@contracts/customer-count";
import Logo from '@/components/shared/Logo';
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { DocumentRequirementContext } from "@contracts/document-requirement-engine";
import { precheckApplicationSearch, precheckDocuments } from "@/lib/precheck-documents";
import { documentCardCopy, documentGroupHeading } from "./document-card-copy";

export default function CustomerPrecheckResult({ context }: { context: DocumentRequirementContext | null }) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const result = context ? precheckDocuments(context) : null;
  return <section className="rounded-2xl border border-[#e8e0d2] bg-white p-5 shadow-sm sm:p-6" aria-live="polite">
    <Logo variant="mark-only" watermark={!result} size={26} />
    <h2 className="text-2xl font-bold text-[#0A1628]">{result ? ar ? `مستنداتك: ${customerFileCount(result.rules.length, true)}` : `Your documents: ${customerFileCount(result.rules.length, false)}` : ar ? "قائمة مستنداتك" : "Your document checklist"}</h2>
    {context && result ? <>
      {result.groups.map(group => <section key={group.key} data-document-group={group.key} className="mt-6">
        <h3 className="border-b border-[#e8e0d2] pb-2 text-sm font-bold text-[#9b7425]">{documentGroupHeading(group.key, context.country_of_residence, ar)}</h3>
        <ul className="mt-3 grid gap-3">{group.cards.map(card => {
          const { label, hint } = documentCardCopy(card, context.nationality, ar);
          return <li key={card.key} data-document-card={card.key} className="rounded-xl border border-[#e8e0d2] bg-[#fcfbf8] p-3">
            <p className="font-semibold text-[#0A1628]">{label}</p><p className="mt-1 text-sm text-slate-600">{hint}</p>
            <ul className={card.pair ? "mt-2 flex flex-wrap gap-2 text-xs text-slate-600" : "sr-only"}>{card.files.map(file => <li key={file.key} data-document-key={file.key} data-document-code={file.code}>{ar ? file.label_ar : file.label_en}</li>)}</ul>
          </li>;
        })}</ul>
      </section>)}
      {!/transit|96hours/i.test(context.visa_type) && <OptionalFlightNotice ar={ar} />}
      <Link to={`/apply?${precheckApplicationSearch(context)}`} className="mt-6 block rounded-xl bg-[#0A1628] px-4 py-4 text-center font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A04C]">{ar ? "ابدأ طلبك — مستنداتك محدّدة بالفعل" : "Start your application — these documents are already matched to you"}</Link>
    </> : <>
      <p className="mt-3 text-sm text-slate-600">{ar ? "أجب عن الأسئلة لترى قائمتك المحدّدة — عادةً من ٦ إلى ٩ ملفات." : "Answer the questions to see your exact list — usually 6 to 9 files."}</p>
      <div aria-hidden="true" data-document-skeleton className="mt-6 space-y-4">{[0, 1].map(group => <div key={group}>
        <div className="mb-3 h-3 w-1/3 rounded bg-slate-200" />{[0, 1, 2].map(card => <div key={card} className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="h-3 w-2/3 rounded bg-slate-200" /><div className="mt-3 h-2 w-4/5 rounded bg-slate-100" /></div>)}
      </div>)}</div>
    </>}
    <p className="mt-6 border-t border-[#e8e0d2] pt-4 text-sm leading-relaxed text-slate-600">{ar ? "هذا الفحص إرشادي فقط. لا يمثل موافقة على التأشيرة أو ضمانًا لقبول الجهات الحكومية." : "This pre-check is guidance only. It is not a visa approval or a guarantee of government acceptance."}</p>
  </section>;
}
