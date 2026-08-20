import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Lock, Shield, UserCircle } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await login(password)) {
      navigate('/admin/applications');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen bg-[#1A2332] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#C9A04C]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-[#C9A04C]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">TASHIRA E-Visa Management</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#C9A04C] focus:outline-none"
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
          <button
            type="submit"
            className="w-full mt-4 py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
          >
            Login
          </button>
        </form>

        {/* Staff Login Link */}
        <div className="mt-6 text-center">
          <a
            href="/staff/login"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#C9A04C] transition-colors"
          >
            <UserCircle size={14} />
            Staff Login
          </a>
        </div>
      </div>
    </div>
  );
}
