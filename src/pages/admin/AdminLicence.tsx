import {Link} from 'react-router-dom';
import CompanyLicenceSettings from '@/components/admin/CompanyLicenceSettings';
export default function AdminLicence(){return <main className="mx-auto max-w-4xl p-6"><Link to="/admin/applications" className="underline">← Administration</Link><CompanyLicenceSettings /></main>;}
