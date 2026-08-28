import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import {
  BarChart3, BriefcaseBusiness, CalendarClock, FileSearch, LogOut,
  MessageSquareText, Scale, Settings2, ShieldCheck, UsersRound,
} from "lucide-react";

const navigation = [
  { to: "/staff/operations/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/staff/dashboard", label: "Applications", icon: BriefcaseBusiness },
  { to: "/staff/operations", label: "Submission Queue", icon: CalendarClock },
  { to: "/staff/operations/support", label: "Support Inbox", icon: MessageSquareText },
  { to: "/staff/operations/supplier-sla", label: "Suppliers & SLA", icon: UsersRound },
  { to: "/staff/operations/regulatory-changes", label: "Visa Rules", icon: Scale },
  { to: "/staff/operations/policies", label: "Operational Policies", icon: Settings2 },
];

export default function OperationsShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { staff, logout } = useStaffAuth();
  return <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[260px_1fr]">
    <aside className="bg-slate-950 px-4 py-5 text-white lg:min-h-screen">
      <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><ShieldCheck size={21}/></span>
        <div><p className="font-bold tracking-[.18em]">TASHIRA</p><p className="text-xs text-slate-400">Visa Operations OS</p></div>
      </div>
      <nav aria-label="Operations navigation" className="mt-5 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/staff/operations"}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-amber-400 font-semibold text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
          <Icon size={17}/><span>{label}</span>
        </NavLink>)}
      </nav>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <p className="font-semibold">{staff?.name ?? "Operations user"}</p>
        <p className="mt-0.5 text-xs text-slate-400">{staff?.username}</p>
        <button type="button" onClick={() => void logout()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/10"><LogOut size={14}/> Sign out</button>
      </div>
    </aside>
    <div className="min-w-0">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-7">
        <div className="mx-auto max-w-7xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-amber-700"><FileSearch size={15}/> Operations Workspace</div>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-7">{children}</div>
    </div>
  </div>;
}
