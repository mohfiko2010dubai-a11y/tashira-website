import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {trpc} from '@/providers/trpc-client';
import {useRequestHost} from '@/providers/request-host';
import {ownershipHtml} from '@contracts/ownership';
export default function OwnershipStatement(){
 const {i18n}=useTranslation();const host=useRequestHost();const {data}=trpc.business.licence.useQuery(undefined,{staleTime:0,refetchInterval:60000});
 useEffect(()=>{if(data?.profile.domains?.includes(host??''))document.getElementById('ownership-shell')?.remove();},[data,host]);
 if(!host||!data?.profile.domains?.includes(host))return null;
 return <div className="my-4 space-y-2 text-sm leading-relaxed" dangerouslySetInnerHTML={{__html:ownershipHtml(host,data.profile,i18n.language.startsWith('ar')?'ar':'en')}}/>;
}
