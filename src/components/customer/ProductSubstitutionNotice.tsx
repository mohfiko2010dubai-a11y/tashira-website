import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";

export function ProductSubstitutionNotice({ referenceNumber }: { referenceNumber: string }) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const application = trpc.application.getByReference.useQuery({ referenceNumber });
  const acknowledge = trpc.application.acknowledgeSubmittedProduct.useMutation({ onSuccess: () => { void application.refetch(); } });
  const app = application.data;
  if (!app?.submittedProduct || app.submittedProduct === app.visaType) return null;
  const accepted = app.substitutionVersion === app.substitutionAcknowledgedVersion;
  return <section className="my-4 rounded border border-amber-300 bg-amber-50 p-4">
    <h2 className="font-semibold">{ar ? "تغيير التأشيرة المقترح" : "Proposed visa change"}</h2>
    <p>{ar ? "التأشيرة المشتراة" : "Purchased visa"}: {app.visaType}</p>
    <p>{ar ? "التأشيرة المقترحة للتقديم" : "Proposed visa for filing"}: {app.submittedProduct}</p>
    <p>{app.submittedReason}</p>
    <p>{ar ? "لن نُقدّم التأشيرة البديلة قبل إقرارك بهذا التغيير." : "We will not file the replacement visa before you acknowledge this change."}</p>
    {accepted ? <p>{ar ? "تم تسجيل إقرارك." : "Your acknowledgement is recorded."}</p> : <button disabled={acknowledge.isPending} className="mt-3 rounded bg-slate-900 px-4 py-3 text-white" onClick={() => acknowledge.mutate({ referenceNumber, version: app.substitutionVersion })}>
      {ar ? "أقرّ بتغيير التأشيرة الموضّح" : "I acknowledge the visa change shown"}
    </button>}
    {acknowledge.error && <p role="alert">{acknowledge.error.message}</p>}
  </section>;
}
