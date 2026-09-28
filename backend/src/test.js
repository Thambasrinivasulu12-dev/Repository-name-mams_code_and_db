// Integration tests: run against a temp DB. `npm test`
process.env.DB_FILE = require('path').join(require('os').tmpdir(), 'mams-test-' + Date.now() + '.db');
const assert = require('assert');
require('./seed');
const server = require('./server');
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const call = async (m, p, tok, body) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok && { Authorization: 'Bearer ' + tok }) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json() }; };
  const login = async (u, p) => (await call('POST', '/api/auth/login', null, { username: u, password: p })).j.token;
  const admin = await login('admin', 'Admin@123'), cmd = await login('commander.alpha', 'Commander@123'), log = await login('logistics.alpha', 'Logistics@123');
  assert.equal((await call('POST', '/api/auth/login', null, { username: 'admin', password: 'x' })).s, 401);
  assert.equal((await call('GET', '/api/dashboard')).s, 401);

  // Balance math: Fort Alpha, APC, whole period. purchases 10+4, out 3, expended 0 => closing 11
  let d = (await call('GET', '/api/dashboard?base_id=1&type_id=1', admin)).j;
  assert.deepEqual([d.totals.purchases, d.totals.transfer_out, d.totals.net_movement, d.totals.closing], [14, 3, 11, 11]);
  // Opening balance for Sept: 10 purchased - 3 transferred (July) = 7 ; net in Sept = +4 ; closing 11
  d = (await call('GET', '/api/dashboard?base_id=1&type_id=1&from=2026-09-01&to=2026-09-30', admin)).j;
  assert.deepEqual([d.totals.opening, d.totals.net_movement, d.totals.closing], [7, 4, 11]);
  assert.equal(d.detail.purchases.length, 1);

  // RBAC
  assert.equal((await call('GET', '/api/dashboard?base_id=2', cmd)).s, 403);      // other base
  assert.equal((await call('GET', '/api/assignments', log)).s, 403);               // logistics: no assignments
  assert.equal((await call('POST', '/api/expenditures', log, { equipment_type_id: 5, quantity: 1 })).s, 403);
  assert.equal((await call('GET', '/api/audit-log', cmd)).s, 403);                 // admin-only
  const own = (await call('GET', '/api/purchases', cmd)).j; assert(own.every(p => p.base_id === 1));

  // Business rules
  assert.equal((await call('POST', '/api/transfers', log, { to_base_id: 2, equipment_type_id: 1, quantity: 999 })).s, 409); // insufficient stock
  assert.equal((await call('POST', '/api/transfers', log, { to_base_id: 1, equipment_type_id: 1, quantity: 1 })).s, 400);   // same base
  const t = await call('POST', '/api/transfers', log, { to_base_id: 2, equipment_type_id: 1, quantity: 1 }); assert.equal(t.s, 201);
  d = (await call('GET', '/api/dashboard?base_id=1&type_id=1', admin)).j; assert.equal(d.totals.closing, 10);
  const audit = (await call('GET', '/api/audit-log', admin)).j; assert(audit.some(a => a.status === 403) && audit.some(a => a.path === '/api/transfers' && a.status === 201));
  assert(!JSON.stringify(audit).includes('Admin@123'));
  console.log('All tests passed'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
