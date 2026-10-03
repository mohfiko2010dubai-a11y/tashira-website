import { INTAKE_CLOSED_COPY } from '@contracts/application-intake';

export default function IntakeNotice() {
  return (
    <section role="status" className="mx-auto max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-6 text-[#1A2332]">
      <p lang="en" dir="ltr">{INTAKE_CLOSED_COPY.en}</p>
      <p lang="ar" dir="rtl">{INTAKE_CLOSED_COPY.ar}</p>
      <a href="/recover" className="block underline">Resume an existing application / متابعة طلب قائم</a>
    </section>
  );
}
