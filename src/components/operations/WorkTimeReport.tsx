import { trpc } from '@/providers/trpc-client';
export default function WorkTimeReport() {
  const report = trpc.operationsWork.managerReport.useQuery(undefined, { refetchInterval: 60000, retry: false });
  if (report.isLoading) return <p role="status">جارٍ تحميل تقرير الموظفين…</p>;
  if (report.isError) return <p role="alert">تعذر تحميل تقرير الموظفين. حدّث الصفحة بحساب المدير وحاول مجددًا.</p>;
  return <section dir="rtl" className="mb-5 rounded-xl border bg-white p-5">
    <h2 className="text-xl font-bold">متابعة عمل الموظفين — {report.data?.day} بتوقيت دبي</h2>
    <p className="my-3 text-sm text-slate-600">الأوقات من حالات العمل والتواجد المسجّلة. وقت الانتظار الخارجي يخص الطلبات، ولا يُحسب وقت عمل للموظف. التواجد دون طلب نشط ليس دليل تقصير.</p>
    <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr>
      {['الموظف','استلم اليوم','أنهى العمل عليها','عمل مسجّل (دقيقة)','متابعة جاهزة (دقيقة)','انتظار الطلبات الخارجي (دقيقة)','متاح بلا عمل نشط (دقيقة)'].map(title => <th key={title} className="border-b p-3">{title}</th>)}
    </tr></thead><tbody>{report.data?.staff.map(row => <tr key={row.staffId}>
      {[row.name,row.claimedToday,row.completedCount,Math.round(row.activeMinutes),Math.round(row.readyMinutes),Math.round(row.externalCaseMinutes),Math.round(row.availableWithoutActiveMinutes)].map((value,i) => <td key={i} className="border-b p-3">{value}</td>)}
    </tr>)}</tbody></table></div>
    {report.data?.staff.length === 0 && <p className="mt-3">لم تُسجل حالات تواجد أو عمل بعد.</p>}
  </section>;
}
