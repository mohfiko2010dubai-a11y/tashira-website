import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), send: vi.fn(), claim: vi.fn(), admin: vi.fn(), payment: vi.fn() }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => ({ execute: mocks.execute,
  getConnection: async () => ({ beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {}, execute: mocks.claim }),
}) }));
vi.mock('./customer-notification-email', () => ({ sendCustomerNotification: mocks.send }));
vi.mock('./payment-success-email', () => ({ sendPaymentSuccessEmail: mocks.payment }));
vi.mock('./refund-outcome-email', () => ({ sendRefundOutcomeEmail: vi.fn() }));
vi.mock('./email-provider', () => ({ adminEmailRecipient: mocks.admin }));
import { runTransactionalEmails } from './transactional-email-worker';

const application = () => ({ reference_number: 'TSH-SYNTHETIC', contact_email: 'synthetic@example.invalid', preferred_language: 'ar', payment_status: 'paid', status: 'under_review', visa_type: '30days-single', submitted_product: '14days-single', substitution_version: 2, substitution_acknowledged_version: null as number | null });
const job = () => ({ job_key: 'substitution:91:2', application_id: 91, template: 'PRODUCT_SUBSTITUTED', variables_json: { originalProduct: '30days-single', replacementProduct: '14days-single' } });
let current: ReturnType<typeof application>;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com'); current = application();
  mocks.admin.mockReturnValue('');
  let pending = true;
  mocks.claim.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT *')) { const rows = pending ? [job()] : []; pending = false; return [rows]; }
    return [{}];
  });
  mocks.execute.mockImplementation(async (sql: string) => sql.startsWith('SELECT reference_number') ? [[current]] : [{}]);
  mocks.send.mockResolvedValue({ status: 'SENT' });
});
afterEach(() => vi.unstubAllEnvs());
describe('durable transactional email dispatch', () => {
  it.each(['en', 'ar'])('uses the application recipient, current %s language and stable status-event identity', async language => {
    current.preferred_language = language;
    const queued = { ...job(), job_key: 'application-status:source-event-1', template: 'STATUS_CHANGED',
      variables_json: { statusLabel: 'old language', statusLabelEn: 'Documents received for review', statusLabelAr: 'تم استلام المستندات للمراجعة' } };
    let pending = true;
    mocks.claim.mockImplementation(async (sql: string) => {
      if (!sql.startsWith('SELECT *')) return [{}];
      const rows = pending ? [queued] : []; pending = false; return [rows];
    });
    await runTransactionalEmails();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'synthetic@example.invalid',
      sourceReference: queued.job_key, variables: expect.objectContaining({ statusLabel: language === 'ar' ? queued.variables_json.statusLabelAr : queued.variables_json.statusLabelEn }) }));
    const seeds = mocks.execute.mock.calls.filter(([sql]) => String(sql).includes('FROM application_timeline_events e WHERE e.event_name'));
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds.every(([sql]) => String(sql).includes("e.event_source<>'STATUS_OUTBOX'"))).toBe(true);
  });
  it.each(['APPROVAL_PENDING', 'GUARANTEE_BREACHED', 'CONNECTION_BROKEN'])('routes %s to the admin inbox and exact case without trusting an admin flag', async template => {
    mocks.admin.mockReturnValue('admin@tashiraev.com');
    let pending = true;
    mocks.claim.mockImplementation(async (sql: string) => {
      if (!sql.startsWith('SELECT *')) return [{}];
      const rows = pending ? [{ ...job(), template, job_key: 'approval:00000000-0000-4000-8000-000000000042', variables_json: {} }] : [];
      pending = false; return [rows];
    });
    await runTransactionalEmails();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'admin@tashiraev.com', variables: expect.objectContaining({ refundCaseId: '00000000-0000-4000-8000-000000000042', actionUrl: 'https://staging.tashiraev.com/admin/approvals#refund-case-00000000-0000-4000-8000-000000000042' }) }));
  });
  it('sends the current proposal with the stored customer-language route', async () => {
    await runTransactionalEmails();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ template: 'PRODUCT_SUBSTITUTED', sourceReference: 'substitution:91:2', variables: expect.objectContaining({ actionUrl: 'https://staging.tashiraev.com/ar/apply/TSH-SYNTHETIC/interview' }) }));
  });
  it.each(['new-version','accepted','product-changed'] as const)('does not send a stale proposal: %s', async scenario => {
    if (scenario === 'new-version') current.substitution_version = 3;
    if (scenario === 'accepted') current.substitution_acknowledged_version = 2;
    if (scenario === 'product-changed') current.submitted_product = '60days-single';
    await runTransactionalEmails(); expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('failure_message=?'), ['SUPPRESSED', null, 'substitution:91:2']);
  });
  it('keeps provider failure visible and retryable under the same job key', async () => {
    mocks.send.mockResolvedValue({ status: 'FAILED' });
    await runTransactionalEmails();
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('failure_message=?'), ['FAILED', expect.stringContaining('retry'), 'substitution:91:2']);
  });
});



describe('payment timeline email identity', () => {
  it('selects the event payment instead of the newest invoice on the application', async () => {
    let pending = true;
    mocks.claim.mockImplementation(async (sql: string) => {
      if (!sql.startsWith('SELECT *')) return [{}];
      const rows = pending ? [{ ...job(), template: 'PAYMENT_SUCCESS', job_key: 'timeline:event-original', variables_json: {} }] : [];
      pending = false; return [rows];
    });
    mocks.execute.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT reference_number')) return [[current]];
      if (sql.startsWith('SELECT i.invoice_number')) {
        expect(params).toEqual([91, 'event-original']);
        expect(sql).toContain('p.id=e.payment_id AND p.application_id=e.application_id');
        expect(sql).toContain("e.event_name='PAYMENT_CONFIRMED'");
        expect(sql).not.toContain('ORDER BY i.id DESC');
        return [[{ invoice_number: 'TEST-INV-1', amount: '185.00', pdf_path: 'archive:TEST-INV-1', payment_id: 5, currency: 'USD' }]];
      }
      return [{}];
    });
    mocks.payment.mockResolvedValue({ status: 'SENT' });
    await runTransactionalEmails();
    expect(mocks.payment).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 91, paymentId: 5, invoiceNumber: 'TEST-INV-1', amountPaid: 185 }));
  });
});
