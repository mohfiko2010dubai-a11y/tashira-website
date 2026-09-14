import Logo from '@/components/shared/Logo';
export function CreationResumeNotice({ referenceNumber, pending, onResume, onStartNew, ar }: {
  referenceNumber?: string | null; pending: boolean; onResume: () => void; onStartNew: () => void; ar: boolean;
}) {
  if (!referenceNumber) return null;
  return <div className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" role="status">
    <Logo variant="mark-only" size={24} />
    <p>{ar ? "لديك طلب محفوظ. تابع الطلب نفسه أو ابدأ طلبًا آخر." : "You have a saved application. Resume it or explicitly start another application."}</p>
    <div className="mt-2 flex flex-wrap gap-4">
      <button type="button" onClick={onResume} className="font-semibold underline">{ar ? "متابعة الطلب المحفوظ" : "Resume saved application"}</button>
      <button type="button" onClick={onStartNew} disabled={pending} className="underline disabled:opacity-50">{ar ? "بدء طلب آخر" : "Start another application"}</button>
    </div>
  </div>;
}
