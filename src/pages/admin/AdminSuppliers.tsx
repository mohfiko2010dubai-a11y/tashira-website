import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { trpc } from '@/providers/trpc';
import type { SupplierListItem } from '@/types/trpc';
import { ArrowLeft, Plus, Edit2, Trash2, LogOut, X, Save, Building2 } from 'lucide-react';

interface SupplierForm {
  id?: number;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: SupplierForm = { name: '', contactPerson: '', email: '', phone: '', notes: '' };

export default function AdminSuppliers() {
  const { logout } = useAdminAuth();
  const utils = trpc.useUtils();
  const { data: suppliers, isLoading } = trpc.supplier.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const createMut = trpc.supplier.create.useMutation({
    onSuccess: () => { utils.supplier.list.invalidate(); setShowForm(false); setForm(emptyForm); },
  });
  const updateMut = trpc.supplier.update.useMutation({
    onSuccess: () => { utils.supplier.list.invalidate(); setShowForm(false); setForm(emptyForm); },
  });
  const deleteMut = trpc.supplier.delete.useMutation({
    onSuccess: () => utils.supplier.list.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.id) {
      updateMut.mutate({ id: form.id, name: form.name, contactPerson: form.contactPerson, email: form.email, phone: form.phone, notes: form.notes });
    } else {
      createMut.mutate({ name: form.name, contactPerson: form.contactPerson, email: form.email, phone: form.phone, notes: form.notes });
    }
  };

  const edit = (s: SupplierListItem) => { setForm({ id: s.id, name: s.name, contactPerson: s.contactPerson || '', email: s.email || '', phone: s.phone || '', notes: s.notes || '' }); setShowForm(true); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1A2332] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/applications" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-lg font-bold">Suppliers</h1>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"><LogOut size={14} /> Logout</button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Building2 size={20} className="text-[#C9A04C]" />
            <h2 className="text-lg font-semibold">Supplier Management</h2>
          </div>
          <button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#C9A04C] text-white rounded-lg text-sm hover:shadow-md transition-all">
            <Plus size={14} /> Add Supplier
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{form.id ? 'Edit' : 'Add'} Supplier</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input type="text" placeholder="Supplier Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" required />
              <input type="text" placeholder="Contact Person" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <input type="text" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:outline-none" rows={2} />
            </div>
            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-[#C9A04C] text-white rounded-lg text-sm font-medium hover:shadow-md transition-all">
              <Save size={14} /> Save
            </button>
          </form>
        )}

        {isLoading ? (
          <p className="text-gray-400 text-center py-10">Loading...</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th><th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {(suppliers || []).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.contactPerson || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.email || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.phone || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.isActive === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{s.isActive}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => edit(s)} className="p-1 text-gray-400 hover:text-[#C9A04C]"><Edit2 size={14} /></button><button onClick={() => { if (confirm('Delete?')) deleteMut.mutate({ id: s.id }); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!suppliers || suppliers.length === 0) && <p className="text-center py-10 text-gray-400">No suppliers yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
