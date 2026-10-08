import type { RuleDiagnostic } from '@contracts/document-requirement-engine';
export function ApplicationDocumentDiagnostics({ applicants }: { applicants: readonly {
  applicantId: number; label: string; suppressed: readonly RuleDiagnostic[]; unmatched: readonly RuleDiagnostic[];
}[] }) {
  const draftCount = applicants.reduce((total, applicant) => total + applicant.suppressed.filter(rule => rule.reason === 'draft').length, 0);
  return <details dir="rtl" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <summary className="cursor-pointer font-semibold">تفاصيل القواعد — للمراجعة المتقدمة{draftCount > 0 && ` · ${draftCount} قواعد مسودة غير مفعّلة`}</summary>
    <p className="mt-3 text-sm text-slate-600">القواعد غير المنطبقة لا تعني وجود مستندات ناقصة. هذا القسم يشرح كيف اختار النظام متطلبات كل مسافر.</p>
    {applicants.map(applicant => {
      const drafts = applicant.suppressed.filter(rule => rule.reason === 'draft');
      return <div key={applicant.applicantId} className="mt-4 border-t pt-3 text-sm"><strong>{applicant.label}</strong>
        {drafts.length > 0 ? <p className="mt-2 rounded bg-amber-50 p-3 text-amber-900">قواعد مسودة لم تُعرض للعميل: {drafts.map(rule => rule.key).join('، ')}</p> : <p className="mt-2">لا توجد قواعد مسودة منطبقة تم استبعادها.</p>}
        <details className="mt-2"><summary className="cursor-pointer">القواعد التي لا تنطبق على هذا المسافر ({applicant.unmatched.length})</summary><ul className="mt-3 space-y-2" dir="ltr">{[...applicant.suppressed.filter(rule => rule.reason !== 'draft'), ...applicant.unmatched].map((rule, index) => <li key={`${rule.key}-${index}`}><code>{rule.key}</code>: {rule.reason} {rule.conditions?.join(', ')}</li>)}</ul></details>
      </div>;
    })}
  </details>;
}
