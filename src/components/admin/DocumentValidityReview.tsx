import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import { visaLabel } from './application-display';
import type { ValidityFinding } from '@contracts/document-validity';

function Finding({ title, finding }: { title: string; finding: ValidityFinding }) {
  const labels = { UNKNOWN: 'تحتاج تأكيدًا', BELOW: 'الصلاحية أقل من المطلوب', MEETS: 'تستوفي المدة المطلوبة حسب التواريخ المسجلة' };
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <h4 className="font-semibold">{title}</h4>
    <p className="mt-2 text-slate-600">تاريخ الانتهاء: <bdi>{finding.expiry || 'غير مسجّل'}</bdi></p>
    <p className={`mt-2 text-sm font-semibold ${finding.status === 'MEETS' ? 'text-emerald-700' : 'text-amber-800'}`}>{labels[finding.status]}</p>
    {finding.status === 'UNKNOWN' && <p className="mt-1 text-sm text-slate-600">{!finding.expiry ? 'راجع المستند وسجّل التاريخ إذا كان مطلوبًا لهذا المسافر.' : 'أكد تاريخ الدخول لتحديد مدة الصلاحية المطلوبة.'}</p>}
    {finding.requiredUntil && <p className="mt-2 text-sm">الصلاحية المطلوبة حتى: <bdi>{finding.requiredUntil}</bdi></p>}
  </div>;
}
export function DocumentValidityReview({ referenceNumber, mode = 'review' }: { referenceNumber: string; mode?: 'review' | 'change' }) {
  const facts = trpc.application.documentReviewFacts.useQuery({ referenceNumber });
  const record = trpc.application.recordDocumentReview.useMutation();
  const propose = trpc.application.proposeSubmittedProduct.useMutation();
  const products = trpc.catalog.adminProducts.useQuery(undefined, { enabled: mode === 'change' });
  const application = trpc.application.getByReference.useQuery({ referenceNumber });
  const [result, setResult] = useState('');
  const control = 'mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-[#C9A04C]';
  return <section dir="rtl" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <div><h2 className="text-xl font-bold">{mode === 'change' ? 'اقتراح تعديل التأشيرة' : 'مراجعة صلاحية المستندات'}</h2>
      <p className="mt-2 text-slate-600">{mode === 'change' ? 'راجع النوعين واذكر سبب التغيير قبل حفظ المقترح للعميل.' : 'راجع صور المستندات أولًا؛ التواريخ التي أدخلها العميل تحتاج مطابقة مع المستند الأصلي.'}</p></div>
    {mode === 'change' ? <>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">التأشيرة التي اشتراها العميل</p><p className="mt-2 font-bold">{visaLabel(application.data?.visaType)}</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><p className="text-sm text-slate-600">النوع المسجّل للتقديم</p><p className="mt-2 font-bold">{visaLabel(application.data?.submittedProduct)}</p><p className="mt-2 text-sm text-slate-600">تسجيل النوع لا يعني إرساله للجهة أو تحصيل فرق السعر.</p></div></div>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        try { await propose.mutateAsync({ referenceNumber, product: String(data.get('product')), reason: String(data.get('reason')) }); await application.refetch(); setResult('تم حفظ المقترح. يظل التقديم متوقفًا حتى موافقة العميل واستيفاء متطلبات التسوية.'); }
        catch (error) { setResult(error instanceof Error ? error.message : 'تعذر حفظ المقترح. حاول مرة أخرى.'); }
      }}>
        <label className="block font-medium">١. اختر التأشيرة المقترحة<select name="product" required className={control}><option value="">اختر نوع التأشيرة</option>{products.data?.filter(product => product.isActive).map(product => <option key={product.serviceCode} value={product.serviceCode}>{visaLabel(product.serviceCode)}</option>)}</select></label>
        {products.error && <p role="alert" className="text-red-700">تعذر تحميل أنواع التأشيرات. حدّث الصفحة قبل اقتراح التعديل.</p>}
        <label className="block font-medium">٢. اشرح سبب التغيير<textarea name="reason" required maxLength={500} rows={3} placeholder="اكتب سببًا واضحًا خاصًا بهذا الطلب" className={control} /></label>
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">هذا الإجراء يحفظ مقترح تعديل. لا يخصم أموالًا ولا ينفّذ استردادًا.</p>
        <button disabled={propose.isPending} className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{propose.isPending ? 'جارٍ الحفظ…' : 'حفظ مقترح التعديل'}</button>
      </form>
    </> : <>
      {facts.isLoading && <p role="status">جارٍ تحميل بيانات المراجعة…</p>}
      {facts.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">تعذر تحميل بيانات المراجعة. حدّث الصفحة قبل تسجيل قرار.</p>}
      {facts.data?.applicants.map((applicant, index) => <article key={applicant.applicantId} className="space-y-4 border-t border-slate-100 pt-5">
        <h3 className="text-lg font-bold">{application.data?.applicants?.find(person => person.id === applicant.applicantId)?.fullName || `المسافر ${index + 1}`}</h3>
        <p className="rounded-xl bg-slate-50 p-3">تاريخ الدخول المتوقع: <bdi>{applicant.entryDate || 'غير محدد — أكّده مع العميل'}</bdi></p>
        <div className="grid gap-3 sm:grid-cols-2"><Finding title="جواز السفر" finding={applicant.passport} /><Finding title="الإقامة — إذا كانت مطلوبة" finding={applicant.residence} /></div>
        {applicant.childReview === 'CONFIRM_CHILD_RATE' && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">قد ينطبق سعر الطفل: راجع تاريخ الميلاد في المستند قبل اعتماد السعر.</p>}
        <form className="space-y-4 rounded-xl bg-slate-50 p-4" onSubmit={async event => {
          event.preventDefault(); const data = new FormData(event.currentTarget); const decision = data.get('decision');
          if (decision !== 'PROCEED' && decision !== 'CONTACT' && decision !== 'SUBSTITUTE' && decision !== 'REFUND') return;
          try { await record.mutateAsync({ referenceNumber, applicantId: applicant.applicantId, decision, reason: String(data.get('reason')) }); setResult('تم تسجيل قرار المراجعة في سجل الطلب. لم يُرسل الطلب للجهة ولم يُنفّذ استرداد أو تواصل مع العميل بهذا الزر.'); }
          catch (error) { setResult(error instanceof Error ? error.message : 'تعذر تسجيل القرار. حاول مرة أخرى.'); }
        }}>
          <label className="block font-medium">نتيجة مراجعتك<select name="decision" className={control}><option value="PROCEED">المتابعة بعد المراجعة</option><option value="CONTACT">يلزم التواصل مع العميل</option><option value="SUBSTITUTE">أوصي بتعديل التأشيرة</option><option value="REFUND">أوصي باسترداد المبلغ</option></select></label>
          <label className="block font-medium">سبب القرار<textarea name="reason" required maxLength={180} rows={2} placeholder="اذكر ما راجعته وما يحتاج إلى إجراء" className={control} /></label>
          <p className="text-sm text-slate-600">تسجيل فقط: التقديم والتواصل والاسترداد تُنفّذ من إجراءاتها المخصصة.</p>
          <button disabled={record.isPending} className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{record.isPending ? 'جارٍ التسجيل…' : 'تسجيل قرار المراجعة'}</button>
        </form>
        <details className="text-sm text-slate-500"><summary className="cursor-pointer">تفاصيل المراجعة التقنية</summary><p className="mt-2">رقم المسافر: {applicant.applicantId} · إصدار القواعد: {facts.data.settingsVersion}</p></details>
      </article>)}
    </>}
    {result && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">{result}</p>}
  </section>;
}
