import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import StaffLogin from './StaffLogin';

export default function AdminLogin() {
  const legacy = trpc.auth.legacyLoginAvailable.useQuery(undefined, { retry: false });
  const [password, setPassword] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  const login = trpc.auth.adminLogin.useMutation({ onSuccess: () => { window.location.href = '/admin/applications'; } });
  if (!showLegacy || !legacy.data) return <>{legacy.data && <button className="absolute top-4 right-4 z-10 rounded bg-white p-3 text-slate-900" onClick={() => setShowLegacy(true)}>Existing administrator sign-in</button>}<StaffLogin /></>;
  return <section className="min-h-screen p-6 bg-slate-100 text-slate-900">
    <h1>Existing administrator access — temporary migration access</h1>
      <form className="max-w-md space-y-3 mt-4" onSubmit={event => { event.preventDefault(); login.mutate({ password }); }}>
        <p>This sign-in remains available until the named administrator has completed password setup and signed in.</p>
        <label className="block">Existing administrator password<input className="block border p-3 w-full" autoComplete="current-password" required type="password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        {login.error && <p role="alert">{login.error.message}</p>}
        <button disabled={login.isPending} className="rounded bg-slate-900 text-white p-3">Sign in with existing access</button>
      </form>
    <button className="underline mt-4" onClick={() => setShowLegacy(false)}>Use username and password</button>
  </section>;
}
