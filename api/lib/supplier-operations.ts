import { TRPCError } from '@trpc/server';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuthorizationActor } from './authorization/policy';
import type { SupplierOperation, SupplierStage } from '../../contracts/supplier-operations';
import { defaultOperationsPool } from './operations/mysql-query-client';

export type SupplierOperationsInput = { search: string; stage?: SupplierStage; includeTest: boolean; offset: number; limit: number };
export async function listSupplierOperations(input: SupplierOperationsInput, actor: AuthorizationActor, manager: boolean, pool: Pool = defaultOperationsPool()) {
  if (!actor.permissions.has('supplier.read_operational') || (!actor.permissions.has('case.read') && !actor.permissions.has('case.read_assigned')))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'قائمة الموردين غير متاحة لحسابك. راجع المدير.' });
  const scopes: string[] = [], parameters: (string | number)[] = [];
  if (actor.scopes.includes('ALL')) scopes.push('1=1');
  if (actor.scopes.includes('ASSIGNED') && /^staff:[1-9][0-9]*$/.test(actor.id)) { scopes.push('c.assigned_staff_user_id=?'); parameters.push(Number(actor.id.slice(6))); }
  if (actor.scopes.includes('TEAM')) for (const id of actor.teamIds) { scopes.push('c.team_id=?'); parameters.push(id); }
  if (actor.scopes.includes('DEPARTMENT')) for (const id of actor.departmentIds) { scopes.push('t.department_id=?'); parameters.push(id); }
  const accounting = manager ? ',a.supplier_cost_aed,a.supplier_vat_amount,a.supplier_total_aed,a.supplier_invoice_number,a.supplier_paid' : '';
  const base = `SELECT a.id applicationId,a.reference_number reference,a.supplier_id supplierId,s.name supplierName,
    COALESCE(a.submitted_product,a.visa_type) product,a.status,a.payment_status paymentStatus,
    (a.is_test=1 OR a.data_classification='TEST') isTest,
    (SELECT COUNT(*) FROM applicants ap WHERE ap.application_id=a.id) applicantCount,
    (SELECT COUNT(DISTINCT ap.id) FROM applicants ap JOIN documents d ON d.applicant_id=ap.id AND d.application_id=ap.application_id
      AND d.document_type='visa' AND d.upload_status='uploaded' WHERE ap.application_id=a.id) visaCount,
    (SELECT MAX(e.occurred_at) FROM operations_submission_evidence e WHERE e.application_id=a.id AND e.supplier_id=a.supplier_id
      AND e.service_code=COALESCE(a.submitted_product,a.visa_type) AND e.applicant_quantity=(SELECT COUNT(*) FROM applicants ep WHERE ep.application_id=a.id) AND e.evidence_kind='SUPPLIER_SENT') supplierSentAt,
    (SELECT MAX(e.occurred_at) FROM operations_submission_evidence e WHERE e.application_id=a.id AND e.supplier_id=a.supplier_id
      AND e.service_code=COALESCE(a.submitted_product,a.visa_type) AND e.applicant_quantity=(SELECT COUNT(*) FROM applicants ep WHERE ep.application_id=a.id) AND e.evidence_kind='AUTHORITY_FILED') authorityFiledAt,
    w.follow_up_at followUpAt,
    (SELECT e.external_reference FROM operations_submission_evidence e WHERE e.application_id=a.id AND e.supplier_id=a.supplier_id
      AND e.service_code=COALESCE(a.submitted_product,a.visa_type) AND e.applicant_quantity=(SELECT COUNT(*) FROM applicants ep WHERE ep.application_id=a.id) ORDER BY e.recorded_at DESC,e.id DESC LIMIT 1) externalReference
    ${accounting} FROM applications a JOIN suppliers s ON s.id=a.supplier_id
    LEFT JOIN operations_case_controls c ON c.application_id=a.id LEFT JOIN operations_teams t ON t.id=c.team_id
    LEFT JOIN operations_case_work w ON w.application_id=a.id
    WHERE (${scopes.join(' OR ') || 'FALSE'}) ${input.includeTest ? '' : "AND a.data_classification='LIVE' AND a.is_test=0"}
    AND (a.reference_number LIKE ? OR s.name LIKE ?)`;
  parameters.push(`%${input.search}%`, `%${input.search}%`);
  const classified = `SELECT b.*,CASE
    WHEN status IN ('cancelled','rejected') THEN 'CLOSED'
    WHEN paymentStatus='paid' AND status IN ('visa_received','completed') AND applicantCount>0 AND visaCount=applicantCount THEN 'VISAS_READY'
    WHEN authorityFiledAt IS NOT NULL THEN 'FILED'
    WHEN supplierSentAt IS NOT NULL THEN 'SENT'
    WHEN status IN ('visa_processing','visa_received','completed') THEN 'REVIEW'
    ELSE 'SELECTED' END stage FROM (${base}) b`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [counts] = await connection.execute<RowDataPacket[]>(`SELECT stage,COUNT(*) total FROM (${classified}) o GROUP BY stage`, parameters);
    const filter = input.stage ? 'WHERE stage=?' : '';
    const [items] = await connection.execute<RowDataPacket[]>(`SELECT * FROM (${classified}) o ${filter}
      ORDER BY followUpAt IS NULL,followUpAt,applicationId LIMIT ? OFFSET ?`, [...parameters, ...(input.stage ? [input.stage] : []), input.limit, input.offset]);
    await connection.commit();
    const date = (value: unknown): string | null => value == null ? null : value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
    const amount = (value: unknown): string | null => value == null ? null : String(value);
    return { counts: Object.fromEntries(counts.map(row => [String(row.stage), Number(row.total)])),
      items: items.map((row): SupplierOperation => ({ applicationId: Number(row.applicationId), reference: String(row.reference),
        supplierId: Number(row.supplierId), supplierName: String(row.supplierName), product: String(row.product), status: String(row.status),
        stage: row.stage as SupplierStage, applicantCount: Number(row.applicantCount), visaCount: Number(row.visaCount),
        supplierSentAt: date(row.supplierSentAt), authorityFiledAt: date(row.authorityFiledAt), followUpAt: date(row.followUpAt),
        externalReference: row.externalReference == null ? null : String(row.externalReference), isTest: Boolean(row.isTest),
        ...(manager ? { accounting: { supplierCostAed: amount(row.supplier_cost_aed), supplierVatAmount: amount(row.supplier_vat_amount),
          supplierTotalAed: amount(row.supplier_total_aed), supplierInvoiceNumber: amount(row.supplier_invoice_number), supplierPaid: amount(row.supplier_paid) } } : {}),
      })) };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
