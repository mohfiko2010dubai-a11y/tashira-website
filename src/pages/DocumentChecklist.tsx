import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { documentResultContext, documentResultSearch } from "@contracts/document-result-route";
import { languagePath } from "@contracts/language-routes";
import { trpc } from "@/providers/trpc-client";
import CustomerPrecheckResult from "@/components/customer/CustomerPrecheckResult";

export default function DocumentChecklist() {
  const [params] = useSearchParams();const { i18n } = useTranslation();const ar = i18n.language.startsWith("ar");
  const catalog = trpc.catalog.listActiveProducts.useQuery();const parsed = documentResultContext(params);
  const context = parsed && catalog.data?.some(product => product.id === parsed.visa_type) ? parsed : null;
  const path = context ? languagePath("/documents", ar ? "ar" : "en") + "?" + documentResultSearch(context) : "";
  const [message, setMessage] = useState("");
  const shareUrl = () => new URL(path, window.location.origin).href;
  return <main className="mx-auto max-w-4xl px-4 pb-12 pt-32">
    <h1 className="mb-6 text-3xl font-semibold">{ar ? "قائمة مستنداتك" : "Your document checklist"}</h1>
    {!context && <p role="status" className="mb-4">{ar ? "اختر الجنسية وبلد الإقامة وخدمة التأشيرة في الفحص المبدئي لعرض المستندات." : "Choose a nationality, country of residence and available visa service in the pre-check to see your documents."}</p>}
    <CustomerPrecheckResult context={context} />
    {context && <div className="mt-5 flex flex-wrap gap-3">
      <button className="min-h-11 rounded-xl border px-4" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl());setMessage(ar ? "تم نسخ الرابط." : "Link copied."); } catch { setMessage((ar ? "تعذّر النسخ تلقائيًا. انسخ هذا الرابط: " : "Automatic copy failed. Copy this link: ") + shareUrl()); } }}>{ar ? "نسخ الرابط" : "Copy link"}</button>
      <button className="min-h-11 rounded-xl border px-4" onClick={() => window.open("https://wa.me/?text=" + encodeURIComponent(shareUrl()), "_blank", "noopener,noreferrer")}>{ar ? "إرسال عبر واتساب" : "Send on WhatsApp"}</button>
    </div>}
    <p aria-live="polite" className="mt-3 break-all text-sm">{message}</p>
    <Link to="/visa-pre-check" className="mt-4 inline-block underline">{ar ? "تعديل الاختيارات" : "Change selections"}</Link>
  </main>;
}
