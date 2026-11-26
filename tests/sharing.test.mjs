import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/bills.mjs';
import data from '../site/bill-data.js';
const origin = 'https://bill-please.netlify.app';
const bill = { title: 'Coffee with Zoë ☕', hasSubtitle: false, date: '2026-11-26', time: '12:15', items: [{ name: 'A long walk', cost: 'priceless' }], total: 'a day well spent', note: 'See you soon!', paper: 'white', style: 'coffee' };
function fixture() {
  const entries = new Map();
  const store = {
    async get(id) { return entries.get(id) ?? null; },
    async setJSON(id, value, { onlyIfNew }) { if (onlyIfNew && entries.has(id)) return { modified: false }; entries.set(id, structuredClone(value)); return { modified: true }; }
  };
  return { entries, store, handle: createHandler(() => store) };
}
const post = (value, headers = {}) => new Request(origin + '/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(value) });
test('opaque short link round-trips Unicode and persists across handler instances', async () => {
  const f = fixture(); const created = await f.handle(post(bill)); assert.equal(created.status, 201);
  const { id } = await created.json(); assert.match(id, /^[A-Za-z0-9_-]{16}$/); assert.ok(!id.includes('Coffee'));
  const restored = await createHandler(() => f.store)(new Request(origin + '/api/bills?id=' + id));
  assert.equal(restored.status, 200); assert.deepEqual(await restored.json(), data.normalize(bill));
});
test('malformed, incomplete and oversized bills never enter storage', async () => {
  const f = fixture();
  for (const invalid of [{}, { ...bill, date: '2026-02-30' }, { ...bill, time: '12:16' }, { ...bill, items: [] }, { ...bill, items: Array(13).fill(bill.items[0]) }]) assert.equal((await f.handle(post(invalid))).status, 400);
  assert.equal((await f.handle(new Request(origin + '/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await f.handle(post({ ...bill, note: 'x'.repeat(25_000) }))).status, 413);
  assert.equal(f.entries.size, 0);
});
test('rejects cross-origin creation, wrong media type and unsupported methods', async () => {
  const f = fixture(); assert.equal((await f.handle(post(bill, { Origin: 'https://another.example' }))).status, 403);
  assert.equal((await f.handle(post(bill, { 'Content-Type': 'text/plain' }))).status, 415);
  const response = await f.handle(new Request(origin + '/api/bills', { method: 'DELETE' })); assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'GET, POST'); assert.equal(f.entries.size, 0);
});
test('missing links return 404; malformed identifiers return 400', async () => {
  const f = fixture(); assert.equal((await f.handle(new Request(origin + '/api/bills?id=abcdefghijklmnop'))).status, 404);
  assert.equal((await f.handle(new Request(origin + '/api/bills?id=../bad'))).status, 400);
});
test('storage failure is recoverable and does not expose private data', async () => {
  const response = await createHandler(() => { throw new Error('secret token'); })(post(bill)); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret'));
});
test('legacy schema supports missing location and older 400-character notes', () => {
  const old = data.normalize({ ...bill, note: 'a'.repeat(400), paper: 'smooth' }); assert.equal(old.location, ''); assert.equal(old.note.length, 400); assert.equal(old.paper, 'white'); assert.ok(data.complete(old));
});
