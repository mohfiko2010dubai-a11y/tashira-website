import OperationsShell from '@/components/operations/OperationsShell';
import SupplierOperationsBoard from '@/components/operations/SupplierOperationsBoard';
export default function StaffSupplierSla() {
  return <OperationsShell title="متابعة الموردين والهجرة" subtitle="عمليات الطلبات المتاحة لك، من اختيار المورد حتى استلام التأشيرات."><SupplierOperationsBoard /></OperationsShell>;
}
