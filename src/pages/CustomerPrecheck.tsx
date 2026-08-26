import { useState } from "react";
import CustomerPrecheckResult from "@/components/customer/CustomerPrecheckResult";
import { trpc } from "@/providers/trpc-client";

const routes=[
  ["14days-single","14 Days Visa"],["14days-multiple","14 Days Multiple Entry"],["30days-single","30 Days Visa"],["30days-multiple","30 Days Multiple Entry"],["60days-single","60 Days Visa"],["60days-multiple","60 Days Multiple Entry"],["90days-single","90 Days Visa"],["96hours-transit","96 Hours Transit"],
] as const;

export default function CustomerPrecheck(){
  const [routeCode,setRouteCode]=useState<string>(routes[0][0]);
  const [nationality,setNationality]=useState("");
  const [residenceCountry,setResidenceCountry]=useState("");
  const [gccResident,setGccResident]=useState(false);
  const [age,setAge]=useState("");
  const [ticketStatus,setTicketStatus]=useState<"NOT_BOOKED"|"RESERVED"|"CONFIRMED">("NOT_BOOKED");
  const [submitted,setSubmitted]=useState(false);
  const input={routeCode,...(nationality.trim()?{nationality:nationality.trim()}:{}),...(residenceCountry.trim()?{residenceCountry:residenceCountry.trim()}:{}),gccResident,...(age?{age:Number(age)}:{}),ticketStatus};
  const query=trpc.customerPrecheck.evaluate.useQuery(input,{enabled:submitted,retry:false});
  return <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-10"><div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
    <section><p className="text-sm font-semibold uppercase tracking-wider text-[#b58a32]">Visa guidance</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Check your likely visa requirements</h1><p className="mt-3 text-slate-600">Answer a few non-sensitive questions. This check is guidance only and never replaces official review.</p>
      <form className="mt-7 space-y-4 rounded-2xl border bg-white p-6 shadow-sm" onSubmit={event=>{event.preventDefault();setSubmitted(false);queueMicrotask(()=>setSubmitted(true));}}>
        <label className="block text-sm font-medium">Visa service<select value={routeCode} onChange={e=>setRouteCode(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{routes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm font-medium">Nationality<input value={nationality} onChange={e=>setNationality(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. Egyptian" /></label>
        <label className="block text-sm font-medium">Country of residence<input value={residenceCountry} onChange={e=>setResidenceCountry(e.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. United Arab Emirates" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Age<input type="number" min="0" max="120" value={age} onChange={e=>setAge(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-sm font-medium">Ticket status<select value={ticketStatus} onChange={e=>setTicketStatus(e.target.value as typeof ticketStatus)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="NOT_BOOKED">Not booked</option><option value="RESERVED">Reserved</option><option value="CONFIRMED">Confirmed</option></select></label></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={gccResident} onChange={e=>setGccResident(e.target.checked)} />I am a GCC resident</label>
        <button type="submit" className="w-full rounded-xl bg-[#c99a3d] px-5 py-3 font-semibold text-white">Check requirements</button>
      </form></section>
    <div className="lg:pt-20">{query.isFetching?<p aria-live="polite" className="rounded-2xl border p-6">Checking approved rule evidence…</p>:query.data?<CustomerPrecheckResult result={query.data}/>:query.error?<section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold">Pre-check is not available yet</h2><p className="mt-2 text-sm text-slate-700">Please use the application form or contact TASHIRA support. No eligibility decision was made.</p></section>:<section className="rounded-2xl border p-6 text-sm text-slate-600">Your result will appear here after you submit the form.</section>}</div>
  </div></main>;
}
