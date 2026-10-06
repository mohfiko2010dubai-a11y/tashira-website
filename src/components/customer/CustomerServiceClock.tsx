import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";

export function CustomerServiceClock({ referenceNumber }: { referenceNumber: string }) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const query = trpc.application.serviceClock.useQuery({ referenceNumber }, { enabled: Boolean(referenceNumber), retry: false });
  if (query.error) return <p role="status">{ar ? "موعد التقديم غير متاح الآن. أعد تحميل الصفحة أو تواصل مع الدعم." : "Submission timing is unavailable. Refresh or contact support."}</p>;
  if (!query.data?.deadline || query.data.submitted) return null;
  return <section className="my-3 rounded border p-3">
    <p>{ar ? "موعد إرسال الطلب إلى الجهة المختصة" : "Application submission deadline"}: <time dateTime={query.data.deadline}>{new Date(query.data.deadline).toLocaleString(ar ? "ar-AE" : "en-AE", { timeZone: "Asia/Dubai" })} (UTC+4)</time></p>
    <p>{query.data.paused
      ? ar ? "المدة متوقفة أثناء انتظار استكمال المطلوب منك أو حسم التعديل. الموعد المعروض مؤقت ويُحدّث عند انتهاء الانتظار." : "The service clock is paused while awaiting your response or resolution of the amendment. This date is provisional and updates when the wait ends."
      : ar ? "لا تشمل المدة وقت انتظار المستندات أو الموافقة أو دفع الفرق. قرار إصدار التأشيرة وموعده تحددهما الجهة المختصة." : "Time awaiting documents, consent or difference payment is excluded. Visa issuance and its timing are decided by the authority."}</p>
  </section>;
}
