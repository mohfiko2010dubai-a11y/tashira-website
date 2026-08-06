import { useState } from 'react';
import { X, Save, Building2, Calculator, FileText } from 'lucide-react';
import { trpc } from '@/providers/trpc';

interface SupplierCostModalProps {
  applicationId: number;
  currentSupplierId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const VAT_RATES: Record<string, number> = {
  standard: 5,
  zero_rated: 0,
  exempt: 0,
  out_of_scope: 0,
};

const VAT_LABELS: Record<string, string> = {
  standard: 'Standard 5%',
  zero_rated: 'Zero Rated 0%',
  exempt: 'Exempt',
  out_of_scope: 'Out of Scope',
};

export default function SupplierCostModal({ applicationId, currentSupplierId, onClose, onSaved }: SupplierCostModalProps) {
  const { data: suppliersList } = trpc.supplier.list.useQuery();
  const utils = trpc.useUtils();

  const [supplierId, setSupplierId] = useState(currentSupplierId ? String(currentSupplierId) : '');
  const [costAed, setCostAed] = useState('');
  const [vatStatus, setVatStatus] = useState<'standard' | 'zero_rated' | 'exempt' | 'out_of_scope'>('standard');
  const [placeOfSupply, setPlaceOfSupply] = useState<'within_uae' | 'outside_uae'>('within_uae');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const assignMut = trpc.application.assignSupplier.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      utils.application.getByReference.invalidate();
      onSaved();
      onClose();
    },
  });

  // Calculate VAT amount
  const cost = parseFloat(costAed) || 0;
  const vatRate = VAT_RATES[vatStatus] || 0;
  const vatAmount = vatStatus === 'standard' ? cost * (vatRate / 100) : 0;
  const totalWithVat = cost + vatAmount;

  const handleSave = () => {
    if (!supplierId || !costAed) return;
    assignMut.mutate({
      id: applicationId,
      supplierId: parseInt(supplierId),
      supplierCostAed: cost,
      supplierVatStatus: vatStatus,
      supplierPlaceOfSupply: placeOfSupply,
      supplierVatAmount: vatAmount,
      supplierTotalAed: totalWithVat,
      supplierInvoiceNumber: invoiceNumber || undefined,
      supplierNotes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Building2 size={20} className="text-[#C9A04C]" />
            <h3 className="text-lg font-semibold text-gray-900">Supplier Cost Details</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier *</label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none bg-white"
            >
              <option value="">Select supplier...</option>
              {(suppliersList || []).map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Cost AED */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost (AED) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">AED</span>
              <input
                type="number"
                value={costAed}
                onChange={e => setCostAed(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none"
              />
            </div>
          </div>

          {/* VAT Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">VAT Status</label>
            <select
              value={vatStatus}
              onChange={e => setVatStatus(e.target.value as typeof vatStatus)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none bg-white"
            >
              {Object.entries(VAT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Place of Supply */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Place of Supply</label>
            <select
              value={placeOfSupply}
              onChange={e => setPlaceOfSupply(e.target.value as typeof placeOfSupply)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none bg-white"
            >
              <option value="within_uae">Within UAE</option>
              <option value="outside_uae">Outside UAE</option>
            </select>
          </div>

          {/* Supplier Invoice # */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
              <FileText size={14} /> Supplier Invoice #
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-SUP-001"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this supplier..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] focus:outline-none resize-none"
            />
          </div>

          {/* Summary Calculation */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calculator size={14} /> Calculation Summary
            </h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cost</span>
              <span className="font-medium">AED {cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VAT ({vatRate}%)</span>
              <span className="font-medium">AED {vatAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
              <span>Total (with VAT)</span>
              <span className="text-[#C9A04C]">AED {totalWithVat.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!supplierId || !costAed || assignMut.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm font-medium rounded-lg hover:shadow-md transition-all disabled:opacity-50"
          >
            <Save size={14} />
            {assignMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
