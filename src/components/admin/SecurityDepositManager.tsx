import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc-client";

export function SecurityDepositManager({ applicationId }: { applicationId: number }) {
  const utils = trpc.useUtils();
  const requests = trpc.securityDeposit.listByApplication.useQuery({ applicationId });
  const [amount, setAmount] = useState("2500");
  const [purpose, setPurpose] = useState("Refundable security deposit requested for this application");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [message, setMessage] = useState("");
  const requestKey = useRef<{ payload: string; id: string } | null>(null);
  const createRequest = trpc.securityDeposit.createAndSend.useMutation({
    onSuccess: async (result) => {
      setMessage(result.status === "DRAFT" ? "طلب التأمين محفوظ، ولم يتأكد إرسال البريد. راجع القائمة وأعد إرسال الطلب نفسه عند الحاجة."
        : result.replayed ? "هذا طلب التأمين المسجل سابقًا؛ لم ننشئ طلبًا آخر. راجع حالته في القائمة." : "تم إرسال طلب التأمين بنجاح.");
      setAmount(''); setPurpose('');
      await Promise.all([
        utils.securityDeposit.listByApplication.invalidate({ applicationId }),
        utils.timeline.list.invalidate(),
      ]);
    },
    onError: () => setMessage("لم يتأكد إتمام المحاولة. حدّث قائمة التأمين؛ يمكنك إعادة المحاولة بنفس البيانات دون إنشاء طلب مكرر."),
  });
  const resendRequest = trpc.securityDeposit.resend.useMutation({
    onSuccess: async (result) => {
      setMessage(result.status === "SENT" ? "أعيد إرسال طلب التأمين برابط آمن جديد." : "تعذر إرسال البريد مجددًا. يمكنك إعادة محاولة إرسال الطلب نفسه.");
      await Promise.all([
        utils.securityDeposit.listByApplication.invalidate({ applicationId }),
        utils.timeline.list.invalidate(),
      ]);
    },
    onError: () => setMessage("تعذرت إعادة الإرسال. حدّث الحالة قبل المحاولة."),
  });

  return (
    <section dir="rtl" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">التأمين المسترد</h3>
        <p className="text-sm text-gray-500">حدد قيمة التأمين لهذا الطلب. سيتلقى العميل بريدًا به رابط دفع مخصص للتأمين بمدة صلاحية محددة.</p>
      </div>
      {message && <p aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}
      <fieldset disabled={createRequest.isPending || resendRequest.isPending} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm text-gray-600">المبلغ بالدرهم
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="1" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="text-sm text-gray-600 md:col-span-2">سبب طلب التأمين
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" maxLength={255} value={purpose} onChange={(event) => setPurpose(event.target.value)} />
        </label>
        <label className="text-sm text-gray-600">صلاحية الرابط بالأيام
          <input className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm" type="number" min="1" max="30" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} />
        </label>
      </fieldset>
      <button className="rounded-lg bg-[#C9A04C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={createRequest.isPending || resendRequest.isPending || !Number.isFinite(Number(amount)) || Number(amount) < 1 || Number(amount) > 1_000_000 || !Number.isInteger(Number(expiresInDays)) || Number(expiresInDays) < 1 || Number(expiresInDays) > 30 || purpose.trim().length < 5} onClick={() => {
        const payload = { applicationId, amount: Number(amount), purpose, expiresInDays: Number(expiresInDays) };
        const serialized = JSON.stringify(payload);
        if (requestKey.current?.payload !== serialized) requestKey.current = { payload: serialized, id: crypto.randomUUID() };
        createRequest.mutate({ ...payload, commandId: requestKey.current.id });
      }}>إرسال طلب التأمين بالبريد</button>
      <div className="space-y-2">
        {requests.data?.map((request) => (
          <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-sm">
            <span>{request.currency} {Number(request.amount).toFixed(2)} — {request.purpose}</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{request.status}</span>
              {request.status === "DRAFT" && (
                <button className="rounded border border-[#C9A04C] px-2 py-1 font-semibold text-[#8B6B2E] disabled:opacity-50" disabled={resendRequest.isPending} onClick={() => resendRequest.mutate({
                  requestId: request.id,
                  expiresInDays: Number(expiresInDays),
                })}>إعادة إرسال البريد</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
