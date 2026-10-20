import {useState} from 'react';
import {trpc} from '@/providers/trpc-client';
import type {LicenceProfile} from '@contracts/licence-profile';
function Editor({profile,version,onSaved}:{profile:LicenceProfile;version:number;onSaved:()=>void}){
 const [draft,setDraft]=useState(profile);const [message,setMessage]=useState('');const save=trpc.business.saveLicence.useMutation();
 const fields=['legalNameEn','legalNameAr','licence','formation','legalFormEn','legalFormAr','authorityEn','authorityAr','addressEn','addressAr','issuedAt','expiresAt','verificationUrl','documentPreviewPath'] as const;
 return <form className="space-y-4" onSubmit={async e=>{e.preventDefault();try{await save.mutateAsync({expectedVersion:version,profile:draft});setMessage('Licence settings saved. Public pages will refresh.');onSaved();}catch(error){setMessage(error instanceof Error?error.message:'Could not save');}}}>
 {fields.map(field=><label key={field} className="block">{field}<input required={field!=='documentPreviewPath'} type={field.endsWith('At')?'date':field==='verificationUrl'?'url':'text'} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:e.target.value})} className="block w-full rounded border p-2"/></label>)}
 <h3 className="font-bold">Licensed activities — exact bilingual licence text</h3>
 {draft.activities.map((a,index)=><fieldset key={index} className="space-y-2 rounded border p-3">{(['code','en','ar'] as const).map(field=><label key={field} className="block">{field}<textarea required value={a[field]} onChange={e=>setDraft({...draft,activities:draft.activities.map((item,i)=>i===index?{...item,[field]:e.target.value}:item)})} className="block w-full rounded border p-2"/></label>)}</fieldset>)}
 <button disabled={save.isPending} className="rounded bg-slate-900 px-4 py-2 text-white">Save licence version</button><p role="status">{message}</p>
 </form>;
}
export default function CompanyLicenceSettings(){const query=trpc.business.licence.useQuery(undefined,{refetchInterval:60000});const utils=trpc.useUtils();const data=query.data;
 return <section className="space-y-4 rounded border p-4"><h2 className="text-xl font-bold">Company licence</h2>
 {!data?<p>{query.isError?'Licence settings could not be loaded.':'Licence settings are not configured.'}</p>:<Editor key={data.version} profile={data.profile} version={data.version} onSaved={()=>{void utils.business.licence.invalidate();}}/>}</section>;
}