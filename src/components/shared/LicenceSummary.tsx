import {useTranslation} from 'react-i18next';
import {trpc} from '@/providers/trpc-client';
export default function LicenceSummary(){const {i18n}=useTranslation();const {data}=trpc.business.licence.useQuery();if(!data)return null;const ar=i18n.language.startsWith('ar');return <>{data.expiry.status==='expired'?(ar?'الرخصة قيد التجديد':'Licence under renewal'):(ar?`مرخصة في ${data.profile.authorityAr}`:`Licensed in ${data.profile.authorityEn}`)} · {ar?'رخصة':'Licence'} {data.profile.licence}</>;}
