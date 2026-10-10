type CommandStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Event-handler use only. No customer input, email, passport or payment capability
// is stored: only an opaque command UUID under a SHA-256 intent fingerprint.
export async function financialCommand(storage: CommandStorage, scope: string, payload: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ scope, payload })));
  const key = `tashira:financial-command:v1:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const existing = storage.getItem(key);
  if (existing !== null && !uuid.test(existing)) throw new Error('Invalid pending financial command');
  const id = existing || crypto.randomUUID();
  // This write must succeed before the server is asked to create the obligation.
  storage.setItem(key, id);
  return { id, complete: () => { if (storage.getItem(key) === id) storage.removeItem(key); } };
}
