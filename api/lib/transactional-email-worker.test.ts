import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), send: vi.fn(), claim: vi.fn(), admin: vi.fn() }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => ({ execute: mocks.execute,
  getConnection: async () => ({ beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {}, execute: mocks.claim }),
}) }));
vi.mock('./customer-notification-email', () => ({ sendCustomerNotification: mocks.send }));
vi.mock('./payment-success-email', () => ({ sendPaymentSuccessEmail: vi.fn() }));
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
  it.each(['APPROVAL_PENDING', 'GUARANTEE_BREACHED', 'CONNECTION_BROKEN'])('routes %s to the admin inbox and exact case without trusting an admin flag', async template => {
    mocks.admin.mockReturnValue('admin@tashiraev.com');
    let pending = true;
    mocks.claim.mockImplementation(async (sql: string) => {
      if (!sql.startsWith('SELECT *')) return [{}];
      const rows = pending ? [{ ...job(), template, job_key: 'approval:42', variables_json: {} }] : [];
      pending = false; return [rows];
    });
    await runTransactionalEmails();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'admin@tashiraev.com', variables: expect.objectContaining({ refundCaseId: '42', actionUrl: 'https://staging.tashiraev.com/admin/approvals#refund-case-42' }) }));
  });
  it('sends the current proposal with the stored customer-language route', async () => {
    await runTransactionalEmails();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ template: 'PRODUCT_SUBSTITUTED', sourceReference: 'substitution:91:2', variables: expect.objectContaining({ actionUrl: 'https://staging.tashiraev.com/ar/track' }) }));
  });
  it.each(['new-version','accepted','product-changed'] as const)('does not send a stale proposal: %s', async scenario => {
    if (scenario === 'new-version') current.substitution_version = 3;
    if (scenario === 'accepted') current.substitution_acknowledged_version = 2;
    if (scenario === 'product-changed') current.submitted_product = '60days-single';
    await runTransactionalEmails(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('keeps provider failure visible and retryable under the same job key', async () => {
    mocks.send.mockResolvedValue({ status: 'FAILED' });
    await runTransactionalEmails();
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('failure_message=?'), ['FAILED', expect.stringContaining('retry'), 'substitution:91:2']);
  });
});

