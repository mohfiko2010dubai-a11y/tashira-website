export default function OptionalFlightNotice({ ar }: { ar: boolean }) {
  return <aside className="mt-6 rounded-xl border border-dashed border-[#d9cdb5] bg-[#faf7ef] p-4" data-optional-after-payment>
    <h3 className="text-sm font-bold text-slate-600">{ar ? "بعد الدفع، اختياري" : "After payment, optional"}</h3>
    <p className="mt-2 font-semibold">{ar ? "حجز الطيران" : "Flight booking"}</p>
    <p className="mt-1 text-sm text-slate-600">{ar ? "غير محسوب ضمن الملفات المطلوبة، ولا يمنع المتابعة. لا ينطبق على القادمين برًا." : "Not counted in your required files and does not block continuing. Not applicable if arriving overland."}</p>
  </aside>;
}
