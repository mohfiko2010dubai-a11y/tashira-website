import Logo from '@/components/shared/Logo';
import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useStaffAuth();
  const [challenge, setChallenge] = useState<{ challenge: string; setupSecret: string | null } | null>(null);
  const [code, setCode] = useState('');

  const loginMutation = trpc.staff.login.useMutation({
    onSuccess: (data) => {
      setChallenge(data); setPassword('');
    },
    onError: err => setError(err.message),
  });
  const mfaMutation = trpc.staff.completeLogin.useMutation({
    onSuccess: (data) => {
      login(data.staff);
      // Use full page reload instead of navigate to ensure StaffGuard picks up the token
      window.location.href = data.staff.role === 'admin' ? '/admin/applications' : '/staff/operations/dashboard';
    },
    onError: (err) => {
      setError(err.message || 'Invalid username or password');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (challenge) { mfaMutation.mutate({ challenge: challenge.challenge, code }); return; }
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-[#1A2332] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#C9A04C]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Logo variant="mark-only" theme="dark" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Team sign-in</h1>
          <p className="text-gray-400 text-sm mt-1">Use your named account and authenticator</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6">
          {!challenge && <>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            className="w-full px-4 py-3 mb-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#C9A04C] focus:outline-none"
            placeholder="Enter username"
            autoFocus
          />

          {/* Password */}
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full px-4 py-3 pr-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#C9A04C] focus:outline-none"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          </>}
          {challenge && <div className="mb-4 text-white">
            {challenge.setupSecret && <div className="mb-4 rounded border border-white/20 p-3">
              <p>Add this account to your authenticator app using this setup key. Keep it private.</p>
              <code className="mt-2 block break-all select-all">{challenge.setupSecret}</code>
            </div>}
            <label htmlFor="auth-code">Six-digit authenticator code</label>
            <input id="auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} className="mt-2 w-full rounded border border-white/20 bg-white/5 p-3" />
            <button type="button" className="mt-2 underline" onClick={() => { setChallenge(null); setCode(''); setError(''); }}>Start sign-in again</button>
          </div>}

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending || mfaMutation.isPending}
            className="w-full py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loginMutation.isPending || mfaMutation.isPending ? (
              'Logging in...'
            ) : (
              <>
                <LogIn size={16} />
                Login
              </>
            )}
          </button>
        </form>

        {/* Back to admin */}
        <p className="text-center mt-6 text-gray-500 text-sm">
          Admin?{' '}
          <a href="/admin/login" className="text-[#C9A04C] hover:underline">
            Go to Admin Dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
