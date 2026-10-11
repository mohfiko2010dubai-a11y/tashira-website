import SettlementPanel from '@/components/admin/SettlementPanel';
import { visaLabel } from '@/components/admin/application-display';
import { trpc } from '@/providers/trpc-client';
import { useState } from 'react';
import { Link } from 'react-router-dom';
export default function WorkTimeReport() {
  const [financeApplication,setFinanceApplication]=useState<number|null>(null);
  const [includeTest, setIncludeTest] = useState(false);
  const report = trpc.operationsWork.managerReport.useQuery({ includeTest }, { refetchInterval: 60000, retry: false });
  if (report.isLoading) return <p role="status">جارٍ تحميل تقرير الموظفين…</p>;
  if (report.isError) return <p role="alert">تعذر تحميل تقرير الموظفين. حدّث الصفحة بحساب المدير وحاول مجددًا.</p>;
  return <section dir="rtl" className="mb-5 rounded-xl border bg-white p-5">
    <h2 className="text-xl font-bold">متابعة عمل الموظفين — {report.data?.day} بتوقيت دبي</h2>
    <label className="my-3 flex items-center gap-2"><input type="checkbox" checked={includeTest} onChange={event => setIncludeTest(event.target.checked)} />تضمين الطلبات التجريبية في تقرير التشغيل</label>
    <p className="my-3 text-sm text-slate-600">الأوقات من حالات العمل والتواجد المسجّلة. وقت الانتظار الخارجي يخص الطلبات، ولا يُحسب وقت عمل للموظف. التواجد دون طلب نشط ليس دليل تقصير.</p>
    <p className="my-3 text-sm text-slate-600">الإغلاق يُحسب مرة واحدة لآخر موظف أغلق الطلب اليوم. الطلب المعاد فتحه لا يُحسب مغلقًا حتى يُغلق مجددًا. افتح تفاصيل الإغلاق لرؤية الأنواع والنتائج.</p>
    <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr>
      {['الموظف','استلم اليوم','طلبات مغلقة اليوم','عمل مسجّل (دقيقة)','متابعة جاهزة (دقيقة)','انتظار الطلبات الخارجي (دقيقة)','متاح بلا عمل نشط (دقيقة)','تفاصيل الإغلاق'].map(title => <th key={title} className="border-b p-3">{title}</th>)}
    </tr></thead><tbody>{report.data?.staff.map(row => <tr key={row.staffId}>
      {[row.name,row.claimedToday,row.completedCount,Math.round(row.activeMinutes),Math.round(row.readyMinutes),Math.round(row.externalCaseMinutes),Math.round(row.availableWithoutActiveMinutes)].map((value,i) => <td key={i} className="border-b p-3">{value}</td>)}
      <td className="border-b p-3">{row.closedApplications.length ? <details><summary className="cursor-pointer">عرض الطلبات وأنواعها</summary><ul className="mt-2 min-w-64 space-y-3">{row.closedApplications.map(item => <li key={item.applicationId}>
        <Link className="underline" to={`/admin/applications/${encodeURIComponent(item.reference)}`}>{item.reference}</Link>
        <p>{visaLabel(item.visaType)} · {item.processingType === 'express' ? 'مستعجل' : 'عادي'} · {item.status === 'completed' ? 'مكتمل' : item.status === 'cancelled' ? 'ملغى' : 'مرفوض'}</p>
        <time dateTime={new Date(item.closedAt).toISOString()}>{new Date(item.closedAt).toLocaleTimeString('ar-AE', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' })}</time><button className="ms-3 underline" onClick={()=>setFinanceApplication(item.applicationId)}>مطابقة حساب الطلب</button>
      </li>)}</ul></details> : '—'}</td>
    </tr>)}</tbody></table></div>
    {financeApplication!==null&&<div className="mt-5"><button className="mb-3 underline" onClick={()=>setFinanceApplication(null)}>إغلاق المطابقة</button><SettlementPanel key={financeApplication} applicationId={financeApplication}/></div>}
    {report.data?.staff.length === 0 && <p className="mt-3">لم تُسجل حالات تواجد أو عمل بعد.</p>}
  </section>;
}
