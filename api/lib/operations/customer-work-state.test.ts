import { describe, expect, it } from 'vitest';
import { projectCustomerWaits, type CustomerWaitEvent } from '../../../contracts/customer-wait-events';
import { customerWorkState, type CustomerWorkEvidence } from './customer-work-state';

const base: CustomerWorkEvidence = { status: 'documents_pending', open: [], quote: null };
const quote = { id: 'new', state: 'PROPOSED', difference: 3000, paymentLinkIssued: false, refusalResolved: false };
describe('customer evidence routes owned work without changing business facts', () => {
  it('keeps waiting until every outstanding document is answered', () => {
    const at = (n: number) => new Date(n * 1000);
    const event = (id: string, waitKey: string, kind: CustomerWaitEvent['kind'], n: number): CustomerWaitEvent => ({ id, waitKey, kind, occurredAt: at(n), reason: 'DOCUMENTS_REQUESTED' });
    const events = [event('a', 'document:1', 'PAUSE', 1), event('b', 'document:2', 'PAUSE', 2), event('c', 'document:1', 'RESUME', 3)];
    const state = (items: CustomerWaitEvent[]) => customerWorkState({ ...base, open: projectCustomerWaits(items, at(0), at(10)).open }, 'WAIT_CUSTOMER');
    expect(state(events)).toBe('WAIT_CUSTOMER');
    expect(state([...events, event('d', 'document:2', 'RESUME', 4)])).toBe('READY');
    expect(state([...events, events[2], event('d', 'document:2', 'RESUME', 1)])).toBe('READY');
  });
  it('does not use a superseded proposal reply to release the current proposal', () => {
    const open: CustomerWorkEvidence['open'] = [{ waitKey: 'quote:old', reason: 'AMENDMENT_SENT' }, { waitKey: 'quote:new', reason: 'AMENDMENT_SENT' }];
    expect(customerWorkState({ ...base, quote, open }, 'WAIT_CUSTOMER')).toBe('WAIT_CUSTOMER');
    expect(customerWorkState({ ...base, quote, open: open.slice(0, 1) }, 'WAIT_CUSTOMER')).toBe('READY');
  });
  it('returns refusal to the employee but never treats it as settlement', () => {
    expect(customerWorkState({ ...base, quote: { ...quote, state: 'REFUSED' } }, 'WAIT_CUSTOMER')).toBe('READY');
  });
  it('requires approved top-up settlement even if a response closed the consent wait', () => {
    const accepted = { ...quote, state: 'ACCEPTED', paymentLinkIssued: true };
    expect(customerWorkState({ ...base, quote: accepted }, 'WAIT_CUSTOMER')).toBe('WAIT_CUSTOMER');
    expect(customerWorkState({ ...base, quote: { ...accepted, state: 'SETTLED' } }, 'WAIT_CUSTOMER')).toBe('READY');
    expect(customerWorkState({ ...base, quote: { ...accepted, paymentLinkIssued: false } }, 'WAIT_CUSTOMER')).toBe('READY');
    expect(customerWorkState({ ...base, quote: { ...accepted, difference: -3000, state: 'REFUND_PENDING' } }, 'WAIT_CUSTOMER')).toBe('READY');
  });
  it('preserves other unmet requirements after accepting or settling a quote', () => {
    for (const state of ['ACCEPTED', 'SETTLED']) expect(customerWorkState({ ...base, quote: { ...quote, state }, open: [{ waitKey: 'document:1', reason: 'DOCUMENTS_REQUESTED' }] }, 'WAIT_CUSTOMER')).toBe('WAIT_CUSTOMER');
  });
  it('never reopens closed work or pulls filed cases back from the authority', () => {
    for (const status of ['completed', 'cancelled', 'rejected']) expect(customerWorkState({ ...base, status }, 'WAIT_CUSTOMER')).toBe('DONE');
    for (const status of ['visa_processing', 'visa_received']) expect(customerWorkState({ ...base, status }, 'WAIT_AUTHORITY')).toBe('WAIT_AUTHORITY');
    expect(customerWorkState(base, 'ACTIVE')).toBe('ACTIVE');
    expect(customerWorkState(base, 'WAIT_SUPPLIER')).toBe('WAIT_SUPPLIER');
  });
});
