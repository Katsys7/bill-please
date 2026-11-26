import { randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import billData from '../../site/bill-data.js';

const { normalize, complete, MAX_ITEMS } = billData;
const ID = /^[A-Za-z0-9_-]{16}$/;
const MAX_BYTES = 24_576;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, noarchive' };
const json = (value, status = 200, extra = {}) => Response.json(value, { status, headers: { ...headers, ...extra } });

async function readBill(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return { error: 415 };
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return { error: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 };
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); return { error: 413 }; }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!Array.isArray(input?.items) || input.items.length > MAX_ITEMS) return { error: 400 };
    const bill = normalize(input);
    return complete(bill) ? { bill } : { error: 400 };
  } catch { return { error: 400 }; }
}

// Dependency injection keeps tests independent of a real Netlify account/store.
export function createHandler(openStore = () => getStore('bill-please-shared-v1')) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      if (request.method === 'GET') {
        const id = url.searchParams.get('id');
        if (!id || !ID.test(id)) return json({ error: 'Invalid link' }, 400);
        const entry = await openStore().get(id, { type: 'json' });
        if (!entry?.bill) return json({ error: 'Bill not found' }, 404);
        return json(entry.bill, 200, { 'Cache-Control': 'private, max-age=86400' });
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Origin not allowed' }, 403);
      const parsed = await readBill(request);
      if (parsed.error) return json({ error: 'Invalid bill' }, parsed.error);
      const store = openStore();
      for (let attempt = 0; attempt < 3; attempt++) {
        const id = randomBytes(12).toString('base64url');
        const result = await store.setJSON(id, { bill: parsed.bill, createdAt: new Date().toISOString() }, { onlyIfNew: true });
        if (result.modified) return json({ id }, 201);
      }
      return json({ error: 'Please try again' }, 503);
    } catch {
      // Never log the visitor's bill contents or storage credentials.
      return json({ error: 'Sharing is temporarily unavailable' }, 503);
    }
  };
}

export default createHandler();
export const config = {
  path: '/api/bills',
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
