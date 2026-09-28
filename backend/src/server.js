const http = require('http'), crypto = require('crypto');
const { db, verifyPassword } = require('./db');
const { balances, onHand } = require('./inventory');

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || '*';

/* ---------- tokens (HS256 JWT, built-in crypto) ---------- */
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const makeToken = u => { const p = b64({ sub: u.id, exp: Date.now() + 8 * 3600e3 }); const h = b64({ alg: 'HS256', typ: 'JWT' }); return `${h}.${p}.${sign(h + '.' + p)}`; };
function readToken(t) {
  const [h, p, s] = (t || '').split('.');
  if (!s || sign(h + '.' + p) !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp > Date.now() ? c : null;
}

/* ---------- RBAC matrix (enforced by middleware: `guard`) ---------- */
const PERMS = {
  admin:             { dashboard: 'r', purchases: 'rw', transfers: 'rw', assignments: 'rw', expenditures: 'rw', audit: 'r' },
  base_commander:    { dashboard: 'r', purchases: 'rw', transfers: 'rw', assignments: 'rw', expenditures: 'rw' },
  logistics_officer: { dashboard: 'r', purchases: 'rw', transfers: 'rw' },
};
class HttpError extends Error { constructor(s, m) { super(m); this.status = s; } }
const guard = (user, resource, mode) => {
  if (!(PERMS[user.role]?.[resource] || '').includes(mode)) throw new HttpError(403, `Role '${user.role}' cannot ${mode === 'r' ? 'read' : 'write'} ${resource}`);
};
// Non-admins are pinned to their own base; admins may choose any base.
const scopeBase = (user, requested) => {
  if (user.role === 'admin') return requested ? +requested : null;
  if (requested && +requested !== user.base_id) throw new HttpError(403, 'Access limited to your assigned base');
  return user.base_id;
};

/* ---------- helpers ---------- */
const need = (b, ...f) => f.forEach(k => { if (b[k] === undefined || b[k] === '') throw new HttpError(400, `Missing field: ${k}`); });
const posInt = (v, n) => { if (!Number.isInteger(+v) || +v <= 0) throw new HttpError(400, `${n} must be a positive integer`); return +v; };
const dateOf = v => { if (!/^\d{4}-\d{2}-\d{2}/.test(v || '')) throw new HttpError(400, 'Date must be YYYY-MM-DD'); return v; };
const today = () => new Date().toISOString().slice(0, 10);
const exists = (tbl, id, label) => { if (!db.prepare(`SELECT 1 FROM ${tbl} WHERE id=?`).get(id)) throw new HttpError(400, `Unknown ${label}`); };
function filters(q, cfg, user, resource) {
  const w = [], p = [];
  const b = scopeBase(user, q.get('base_id'));
  if (b) { w.push(cfg.base.map(c => `${c}=?`).join(' OR ').replace(/^(.*)$/, '($1)')); cfg.base.forEach(() => p.push(b)); }
  if (q.get('type_id')) { w.push('equipment_type_id=?'); p.push(+q.get('type_id')); }
  if (q.get('from')) { w.push(`${cfg.date}>=?`); p.push(q.get('from')); }
  if (q.get('to')) { w.push(`${cfg.date}<=?`); p.push(q.get('to')); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
}

/* ---------- route table ---------- */
const routes = [];
const route = (method, path, opts, fn) => routes.push({ method, re: new RegExp('^' + path + '$'), opts, fn });

route('POST', '/api/auth/login', { public: true }, ({ body }) => {
  need(body, 'username', 'password');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(body.username);
  if (!u || !verifyPassword(body.password, u.password_hash)) throw new HttpError(401, 'Invalid credentials');
  return { token: makeToken(u), user: pub(u) };
});
const pub = u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, base_id: u.base_id, permissions: PERMS[u.role] });
route('GET', '/api/me', {}, ({ user }) => pub(user));
route('GET', '/api/bases', {}, ({ user }) => db.prepare('SELECT * FROM bases' + (user.role === 'admin' ? '' : ' ORDER BY id=' + user.base_id + ' DESC') ).all());
route('GET', '/api/equipment-types', {}, () => db.prepare('SELECT * FROM equipment_types ORDER BY category,name').all());

route('GET', '/api/dashboard', { res: 'dashboard' }, ({ user, q }) => {
  const baseId = scopeBase(user, q.get('base_id')), typeId = q.get('type_id') || null;
  const from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
  const rows = balances({ from, to, baseId, typeId });
  const totals = rows.reduce((t, r) => { for (const k of ['opening', 'closing', 'net_movement', 'purchases', 'transfer_in', 'transfer_out', 'assigned', 'expended']) t[k] = (t[k] || 0) + r[k]; return t; }, {});
  // detail lists for the "Net Movement" pop-up
  const bt = (base, type) => [baseId, baseId, typeId, typeId, from, to];
  const named = 'JOIN equipment_types t ON t.id=x.equipment_type_id';
  const detail = {
    purchases: db.prepare(`SELECT x.id,x.purchased_at date,b.name base,t.name type,x.quantity,x.supplier FROM purchases x ${named} JOIN bases b ON b.id=x.base_id
      WHERE (?1 IS NULL OR x.base_id=?1) AND (?2 IS NULL OR x.equipment_type_id=?2) AND x.purchased_at BETWEEN ?3 AND ?4 ORDER BY date DESC`).all(baseId, typeId, from, to),
    transfer_in: db.prepare(`SELECT x.id,x.transferred_at date,fb.name from_base,tb.name to_base,t.name type,x.quantity FROM transfers x ${named} JOIN bases fb ON fb.id=x.from_base_id JOIN bases tb ON tb.id=x.to_base_id
      WHERE (?1 IS NULL OR x.to_base_id=?1) AND (?2 IS NULL OR x.equipment_type_id=?2) AND x.transferred_at BETWEEN ?3 AND ?4 ORDER BY date DESC`).all(baseId, typeId, from, to),
    transfer_out: db.prepare(`SELECT x.id,x.transferred_at date,fb.name from_base,tb.name to_base,t.name type,x.quantity FROM transfers x ${named} JOIN bases fb ON fb.id=x.from_base_id JOIN bases tb ON tb.id=x.to_base_id
      WHERE (?1 IS NULL OR x.from_base_id=?1) AND (?2 IS NULL OR x.equipment_type_id=?2) AND x.transferred_at BETWEEN ?3 AND ?4 ORDER BY date DESC`).all(baseId, typeId, from, to),
  };
  return { totals, rows, detail };
});

const LIST_SQL = {
  purchases: ['SELECT x.*,b.name base,t.name type,u.full_name by FROM purchases x JOIN bases b ON b.id=x.base_id JOIN equipment_types t ON t.id=x.equipment_type_id JOIN users u ON u.id=x.created_by', { base: ['x.base_id'], date: 'x.purchased_at' }],
  transfers: ['SELECT x.*,fb.name from_base,tb.name to_base,t.name type,u.full_name by FROM transfers x JOIN bases fb ON fb.id=x.from_base_id JOIN bases tb ON tb.id=x.to_base_id JOIN equipment_types t ON t.id=x.equipment_type_id JOIN users u ON u.id=x.created_by', { base: ['x.from_base_id', 'x.to_base_id'], date: 'x.transferred_at' }],
  assignments: ['SELECT x.*,b.name base,t.name type,u.full_name by FROM assignments x JOIN bases b ON b.id=x.base_id JOIN equipment_types t ON t.id=x.equipment_type_id JOIN users u ON u.id=x.created_by', { base: ['x.base_id'], date: 'x.assigned_at' }],
  expenditures: ['SELECT x.*,b.name base,t.name type,u.full_name by FROM expenditures x JOIN bases b ON b.id=x.base_id JOIN equipment_types t ON t.id=x.equipment_type_id JOIN users u ON u.id=x.created_by', { base: ['x.base_id'], date: 'x.expended_at' }],
};
for (const [name, [sql, cfg]] of Object.entries(LIST_SQL))
  route('GET', `/api/${name}`, { res: name }, ({ user, q }) => {
    const { where, p } = filters(q, cfg, user);
    return db.prepare(`${sql} ${where.replace(/equipment_type_id/g, 'x.equipment_type_id')} ORDER BY ${cfg.date} DESC, x.id DESC`).all(...p);
  });

const insert = (tbl, o) => { const k = Object.keys(o); const r = db.prepare(`INSERT INTO ${tbl}(${k}) VALUES(${k.map(() => '?')})`).run(...k.map(x => o[x])); return { id: Number(r.lastInsertRowid), ...o }; };
const withTx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const stockCheck = (base, type, qty) => { const have = onHand(base, type); if (qty > have) throw new HttpError(409, `Insufficient stock: ${have} available, ${qty} requested`); };

route('POST', '/api/purchases', { res: 'purchases', write: true, status: 201 }, ({ user, body }) => {
  need(body, 'equipment_type_id', 'quantity');
  const base = scopeBase(user, body.base_id) ?? (() => { need(body, 'base_id'); })();
  exists('bases', base, 'base'); exists('equipment_types', body.equipment_type_id, 'equipment type');
  return insert('purchases', { base_id: base, equipment_type_id: +body.equipment_type_id, quantity: posInt(body.quantity, 'quantity'), unit_cost: body.unit_cost ?? null, supplier: body.supplier ?? null, purchased_at: dateOf(body.purchased_at || today()), created_by: user.id });
});
route('POST', '/api/transfers', { res: 'transfers', write: true, status: 201 }, ({ user, body }) => {
  need(body, 'to_base_id', 'equipment_type_id', 'quantity');
  const from = scopeBase(user, body.from_base_id ?? body.base_id) ?? (() => { need({ from_base_id: body.from_base_id ?? body.base_id }, 'from_base_id'); })();
  const to = +body.to_base_id, qty = posInt(body.quantity, 'quantity');
  if (from === to) throw new HttpError(400, 'Source and destination bases must differ');
  exists('bases', from, 'source base'); exists('bases', to, 'destination base'); exists('equipment_types', body.equipment_type_id, 'equipment type');
  return withTx(() => { stockCheck(from, +body.equipment_type_id, qty);
    return insert('transfers', { from_base_id: from, to_base_id: to, equipment_type_id: +body.equipment_type_id, quantity: qty, note: body.note ?? null, transferred_at: dateOf(body.transferred_at || today()), created_by: user.id }); });
});
route('POST', '/api/assignments', { res: 'assignments', write: true, status: 201 }, ({ user, body }) => {
  need(body, 'equipment_type_id', 'quantity', 'assigned_to');
  const base = scopeBase(user, body.base_id) ?? (() => { need(body, 'base_id'); })();
  exists('bases', base, 'base'); exists('equipment_types', body.equipment_type_id, 'equipment type');
  const qty = posInt(body.quantity, 'quantity');
  return withTx(() => { stockCheck(base, +body.equipment_type_id, qty);
    return insert('assignments', { base_id: base, equipment_type_id: +body.equipment_type_id, quantity: qty, assigned_to: body.assigned_to, assigned_at: dateOf(body.assigned_at || today()), created_by: user.id }); });
});
route('POST', '/api/expenditures', { res: 'expenditures', write: true, status: 201 }, ({ user, body }) => {
  need(body, 'equipment_type_id', 'quantity');
  const base = scopeBase(user, body.base_id) ?? (() => { need(body, 'base_id'); })();
  exists('bases', base, 'base'); exists('equipment_types', body.equipment_type_id, 'equipment type');
  const qty = posInt(body.quantity, 'quantity');
  return withTx(() => { stockCheck(base, +body.equipment_type_id, qty);
    return insert('expenditures', { base_id: base, equipment_type_id: +body.equipment_type_id, quantity: qty, reason: body.reason ?? null, expended_at: dateOf(body.expended_at || today()), created_by: user.id }); });
});
route('GET', '/api/audit-log', { res: 'audit' }, ({ q }) =>
  db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(Math.min(+q.get('limit') || 100, 500)));

/* ---------- server ---------- */
const send = (res, s, o) => { res.writeHead(s, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); res.end(JSON.stringify(o)); };
const readBody = req => new Promise((ok, no) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { no(new HttpError(400, 'Invalid JSON')); } }); });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://x'); let user = null, body = {};
  // Audit middleware: every API call (incl. failures/denials) is written to audit_log
  res.on('finish', () => {
    if (!url.pathname.startsWith('/api/') || url.pathname === '/api/audit-log') return;
    if (req.method === 'GET' && res.statusCode < 400 && !url.pathname.startsWith('/api/dashboard')) return; // log reads only for dashboard/errors
    const safe = { ...body }; delete safe.password; if (url.pathname === '/api/auth/login') safe.username = body.username;
    try { db.prepare('INSERT INTO audit_log(user_id,username,method,path,status,payload,ip) VALUES(?,?,?,?,?,?,?)')
      .run(user?.id ?? null, user?.username ?? body.username ?? null, req.method, url.pathname + url.search, res.statusCode, JSON.stringify(safe), req.socket.remoteAddress); } catch {}
  });
  try {
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    const r = routes.find(r => r.method === req.method && r.re.test(url.pathname));
    if (!r) throw new HttpError(404, 'Not found');
    if (req.method === 'POST') body = await readBody(req);
    if (!r.opts.public) {
      const claims = readToken((req.headers.authorization || '').replace('Bearer ', ''));
      user = claims && db.prepare('SELECT * FROM users WHERE id=?').get(claims.sub);
      if (!user) throw new HttpError(401, 'Authentication required');
      if (r.opts.res) guard(user, r.opts.res, r.opts.write ? 'w' : 'r');
    }
    send(res, r.opts.status || 200, r.fn({ user, body, q: url.searchParams }));
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Internal server error' });
  }
});
if (require.main === module) server.listen(PORT, () => console.log(`MAMS API on :${PORT}`));
module.exports = server;
