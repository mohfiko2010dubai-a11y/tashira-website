import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';

export default function StaffSetup() {
  const location = useLocation();
  const [token, setToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const setup = trpc.staff.completeSetup.useMutation({
    onSuccess: data => { setUsername(data.username); setToken(''); setPassword(''); setConfirmation(''); },
    onError: failure => setError(failure.message),
  });
  return <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
    <section className="w-full max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Set up your TASHIRA account</h1>
      {username ? <><p>Password saved for {username}. Sign in and enrol your authenticator to finish setup.</p><a className="underline" href="/staff/login">Continue to secure sign-in</a></> :
        <form className="space-y-4" onSubmit={event => {
          event.preventDefault(); setError('');
          if (password !== confirmation) { setError('Passwords do not match. Enter the same password in both fields.'); return; }
          setup.mutate({ token, password });
        }}>
          <p>Choose your own password. Use at least 12 characters, upper- and lower-case letters and a number. Two-factor authentication is required after sign-in.</p>
          <label className="block">New password<input required minLength={12} maxLength={500} autoComplete="new-password" type="password" className="block w-full p-3 text-black" value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label className="block">Confirm password<input required autoComplete="new-password" type="password" className="block w-full p-3 text-black" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
          {error && <p role="alert">{error}</p>}
          {!token && <p role="alert">Open your one-time setup link from the email. If it has expired, request a new link.</p>}
          <button className="rounded bg-amber-300 text-black px-5 py-3" disabled={!token || setup.isPending}>Save password</button>
        </form>}
    </section>
  </main>;
}
