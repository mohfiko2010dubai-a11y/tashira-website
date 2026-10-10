import { expect, it } from 'vitest';
import { financialCommand } from '../src/lib/financial-command';

function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
it('recovers a lost-response command after remount and concurrent retries', async () => {
  const store = storage(), payload = { reason: 'Synthetic private reason', amount: 10 };
  const first = await financialCommand(store, 'staff:1:refund:4', payload);
  const retries = await Promise.all([financialCommand(store, 'staff:1:refund:4', payload), financialCommand(store, 'staff:1:refund:4', payload)]);
  expect(retries.map(item => item.id)).toEqual([first.id, first.id]);
  expect(JSON.stringify([...store.data])).not.toContain(payload.reason);
  expect([...store.data.keys()][0]).toMatch(/^tashira:financial-command:v1:[a-f0-9]{64}$/);
});
it('isolates actors, applications, operations and changed intent', async () => {
  const store = storage();
  const commands = await Promise.all(['staff:1:refund:4', 'staff:2:refund:4', 'staff:1:refund:5', 'staff:1:deposit:4']
    .map(scope => financialCommand(store, scope, { amount: 10 })));
  commands.push(await financialCommand(store, 'staff:1:refund:4', { amount: 20 }));
  expect(new Set(commands.map(item => item.id)).size).toBe(5);
});
it('allows a fresh deliberate request only after the acknowledged command is cleared', async () => {
  const store = storage(), first = await financialCommand(store, 'scope', { amount: 10 });
  first.complete();
  const next = await financialCommand(store, 'scope', { amount: 10 });
  expect(next.id).not.toBe(first.id);
  first.complete();
  expect((await financialCommand(store, 'scope', { amount: 10 })).id).toBe(next.id);
});
it('does not start a new identity when persistence is unavailable or corrupted', async () => {
  const store = storage();
  await financialCommand(store, 'scope', {});
  store.data.set([...store.data.keys()][0], 'corrupt');
  await expect(financialCommand(store, 'scope', {})).rejects.toThrow('Invalid pending');
  await expect(financialCommand({ ...store, getItem: () => null, setItem: () => { throw new Error('Storage blocked'); } }, 'scope', {})).rejects.toThrow('Storage blocked');
});
