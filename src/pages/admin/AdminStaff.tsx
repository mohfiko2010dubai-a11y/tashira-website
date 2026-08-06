import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import type { StaffListItem } from '@/types/trpc';
import {
  ArrowLeft, Plus, Edit2, Trash2, LogOut, X, Save, Users, Eye, EyeOff,
} from 'lucide-react';

interface StaffForm {
  id?: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isActive: 'active' | 'inactive';
}

const emptyForm: StaffForm = { username: '', name: '', email: '', phone: '', password: '', isActive: 'active' };

export default function AdminStaff() {
  const { logout } = useAdminAuth();
  const utils = trpc.useUtils();
  const { data: staffList, isLoading } = trpc.staff.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const createMut = trpc.staff.create.useMutation({
    onSuccess: () => { utils.staff.list.invalidate(); setShowForm(false); setForm(emptyForm); setError(''); },
    onError: (err) => setError(err.message),
  });
  const updateMut = trpc.staff.update.useMutation({
    onSuccess: () => { utils.staff.list.invalidate(); setShowForm(false); setForm(emptyForm); setError(''); },
    onError: (err) => setError(err.message),
  });
  const deleteMut = trpc.staff.delete.useMutation({
    onSuccess: () => utils.staff.list.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.name.trim()) return;
    if (!form.id && !form.password.trim()) {
      setError('Password is required for new staff');
      return;
    }

    if (form.id) {
      updateMut.mutate({
        id: form.id,
        username: form.username,
        name: form.name,
        email: form.email,
        phone: form.phone,
        isActive: form.isActive,
        password: form.password || undefined,
      });
    } else {
      createMut.mutate({
        username: form.username,
        name: form.name,
        password: form.password,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
    }
  };

  const edit = (s: StaffListItem) => {
    setForm({
      id: s.id,
      username: s.username,
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      password: '',
      isActive: s.isActive || 'active',
    });
    setShowForm(true);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold">Staff Management</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"><LogOut size={14} /> Logout</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#C9A04C]" />
            <h2 className="text-lg font-semibold">Staff Users (Employees)</h2>
          </div>
          <button onClick={() => { setForm(emptyForm); setShowForm(true); setError(''); }} className="flex items-center gap-2 px-4 py-2 bg-[#C9A04C] text-white rounded-lg text-sm hover:shadow-md transition-all">
            <Plus size={14} /> Add Staff
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{form.id ? 'Edit' : 'Add'} Staff User</h3>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input type="text" placeholder="Username *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" required />
              <input type="text" placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" required />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <input type="text" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={form.id ? 'New Password (leave blank to keep)' : 'Password *'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none"
                  required={!form.id}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <select value={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.value as 'active' | 'inactive' })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none bg-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-[#C9A04C] text-white rounded-lg text-sm font-medium hover:shadow-md transition-all">
              <Save size={14} /> {form.id ? 'Update' : 'Create'} Staff
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-center py-10">Loading...</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {(staffList || []).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-[#C9A04C] font-semibold">{s.username}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.phone || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{s.isActive}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => edit(s)} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Edit2 size={14} /></button><button onClick={() => { if (confirm('Delete this staff user?')) deleteMut.mutate({ id: s.id }); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!staffList || staffList.length === 0) && <p className="text-center py-10 text-gray-400">No staff users yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
