import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { LogOut } from 'lucide-react';

const LINKS = [
  { to: '/admin/applications', label: 'Applications' },
  { to: '/admin/visa-rules', label: 'Visa Rules' },
  { to: '/admin/catalogs', label: 'Catalogs' },
  { to: '/admin/dynamic-form', label: 'Dynamic Form' },
  { to: '/admin/feature-flags', label: 'Feature Flags' },
  { to: '/admin/rule-evaluations', label: 'Evaluations' },
  { to: '/admin/invoices', label: 'Invoices' },
  { to: '/admin/finance', label: 'Finance' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/suppliers', label: 'Suppliers' },
  { to: '/admin/chat', label: 'Chat' },
];

/** Shared Owner/Admin navigation bar used by the governance screens. */
export default function AdminTopNav({ title, subtitle }: { title: string; subtitle?: string }) {
  const { logout } = useAdminAuth();
  const location = useLocation();
  return (
    <header className="bg-[#0A1628] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-lg font-extrabold tracking-wide text-[#C9A04C]">TASHIRA Admin</p>
          <h1 className="text-sm font-semibold text-white/90">{title}{subtitle ? ` — ${subtitle}` : ''}</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 hover:text-white">
          <LogOut size={13} /> Logout
        </button>
      </div>
      <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 pb-3">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              location.pathname.startsWith(link.to) ? 'bg-[#C9A04C] font-bold text-[#0A1628]' : 'text-gray-400 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
