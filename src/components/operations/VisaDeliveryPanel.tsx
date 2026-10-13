import { useRef, useState } from 'react';
import { trpc } from '@/providers/trpc-client';

function base64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذر قراءة الملف. اختره مرة أخرى.'));reader.onload=()=>typeof reader.result==='string'?resolve(reader.result.slice(reader.result.indexOf(',')+1)):reject(new Error('تعذر قراءة الملف.'));reader.readAsDataURL(file);});}

export default function VisaDeliveryPanel({applicationId,applicationReference,applicants,applicationStatus,onSaved}:{
  applicationId:number;applicationReference:string;applicants:readonly {applicantId:number;displayName:string}[];applicationStatus?:string;onSaved?:()=>Promise<void>;
}){
  const documents=trpc.document.listByApplication.useQuery({applicationId,documentType:'visa',sortBy:'createdAt',sortOrder:'desc'});
  const deliveries=trpc.operationsVisaDelivery.staffList.useQuery({applicationReference});
  const upload=trpc.storage.upload.useMutation(),create=trpc.document.create.useMutation(),deliver=trpc.operationsVisaDelivery.prepare.useMutation();
  const busyRef=useRef(false),keys=useRef(new Map<number,string>());
  const [selected,setSelected]=useState<Record<number,File>>({});
  const [busy,setBusy]=useState<number|null>(null),[message,setMessage]=useState('');
  const ready=applicationStatus===undefined||['visa_processing','visa_received'].includes(applicationStatus);
  async function send(applicantId:number,file?:File,existingId?:number){
    if(busyRef.current)return;busyRef.current=true;setBusy(applicantId);setMessage('جارٍ رفع التأشيرة وفحصها…');
    try{
      let documentId=existingId;
      if(file){
        const stored=await upload.mutateAsync({applicationId,applicantId,documentType:'visa',fileName:file.name,mimeType:file.type||'application/octet-stream',fileSize:file.size,base64Data:await base64(file),uploadedBy:'operations-staff'});
        const document=await create.mutateAsync({applicationId,applicantId,documentType:'visa',originalFileName:file.name,storedFileName:stored.storedFileName,mimeType:stored.mimeType,fileSize:stored.fileSize,storagePath:stored.storagePath,uploadStatus:'uploaded',uploadedBy:'operations-staff'});
        documentId=document.id;
        setSelected(previous=>{const next={...previous};delete next[applicantId];return next;});
      }
      if(!documentId)throw new Error('اختر ملف التأشيرة.');
      const commandId=keys.current.get(documentId)??crypto.randomUUID();keys.current.set(documentId,commandId);
      await deliver.mutateAsync({applicationReference,applicantId,visaDocumentId:documentId,commandId});
      setSelected(previous=>{const next={...previous};delete next[applicantId];return next;});
      await deliveries.refetch();await onSaved?.();
      setMessage('تم تسليم التأشيرة وتحديث الطلب. أضيفت رسالة التأشيرة إلى قائمة الإرسال للعميل.');
    }catch(error){setMessage(error instanceof Error?error.message:'تعذر تسليم التأشيرة. أعد المحاولة من الملف المرفوع أدناه.');}
    finally{await documents.refetch();busyRef.current=false;setBusy(null);}
  }
  return <section id="visa-delivery" className="space-y-4 rounded-2xl border bg-white p-5">
    <h2 className="text-xl font-bold">رفع التأشيرة وإكمال الطلب</h2>
    <p>اختر ملف التأشيرة واضغط تسليم. يتولى النظام فحصها وإرسالها للعميل وتحديث حالة الطلب تلقائيًا.</p>
    {!ready&&applicationStatus!=='completed'&&<p role="status">سجّل التقديم من «المورد والتقديم» أولًا، ثم ارفع التأشيرة عند وصولها.</p>}
    {(deliveries.isError||documents.isError)&&<p role="alert">تعذر تحميل الملفات. <button className="underline" onClick={()=>{void deliveries.refetch();void documents.refetch();}}>إعادة المحاولة</button></p>}
    {applicants.map(person=>{
      const delivered=deliveries.data?.some(row=>row.applicantId===person.applicantId);
      const waiting=(documents.data??[]).filter(doc=>doc.applicantId===person.applicantId&&doc.uploadStatus==='uploaded'&&!deliveries.data?.some(row=>row.visaDocumentId===doc.id));
      const disabled=!ready||busy!==null||!deliveries.data||documents.isError;
      return <article key={person.applicantId} className="space-y-3 rounded-xl border p-4" aria-label={person.displayName}>
        <h3 className="font-semibold">{person.displayName}</h3>
        {delivered?<p className="text-emerald-800">✓ تم تسليم التأشيرة</p>:<>
          <label className={`inline-block rounded-lg bg-emerald-800 px-5 py-3 text-white ${disabled?'opacity-50':'cursor-pointer'}`}>
            اختيار ملف التأشيرة
            <input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" aria-label={`رفع تأشيرة ${person.displayName}`} disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)setSelected(previous=>({...previous,[person.applicantId]:file}));}} />
          </label>
          {selected[person.applicantId]&&<div className="flex flex-wrap items-center gap-3"><span>{selected[person.applicantId].name}</span><button className="rounded-lg bg-emerald-800 px-5 py-3 text-white" disabled={disabled} onClick={()=>void send(person.applicantId,selected[person.applicantId])}>{busy===person.applicantId?'جارٍ التسليم…':applicants.length===1?'تسليم التأشيرة وإكمال الطلب':'تسليم التأشيرة'}</button></div>}
          {waiting.map(doc=><div key={doc.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{doc.originalFileName}</span><button className="rounded-lg border px-3 py-2" disabled={disabled} onClick={()=>void send(person.applicantId,undefined,doc.id)}>إرسال التأشيرة المرفوعة</button></div>)}
        </>}
      </article>;
    })}
    {applicants.length>1&&<p className="text-sm text-slate-600">يكتمل الطلب تلقائيًا بعد رفع تأشيرة كل مسافر.</p>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
