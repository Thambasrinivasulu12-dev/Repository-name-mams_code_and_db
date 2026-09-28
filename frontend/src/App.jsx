import { useEffect, useState, useCallback } from 'react';
import { api, qs, session } from './api.js';

const PAGES = [
  ['dashboard', 'Dashboard'], ['purchases', 'Purchases'], ['transfers', 'Transfers'],
  ['assignments', 'Assignments & Expenditures'], ['audit', 'Audit Log'],
];
const canSee = (u, key) => key === 'assignments' ? !!(u.permissions.assignments || u.permissions.expenditures) : !!u.permissions[key === 'audit' ? 'audit' : key];

export default function App() {
  const [user, setUser] = useState(null), [page, setPage] = useState('dashboard'), [ready, setReady] = useState(false), [menu, setMenu] = useState(false);
  useEffect(() => { (session.token ? api('/api/me').then(setUser).catch(() => {}) : Promise.resolve()).finally(() => setReady(true)); }, []);
  if (!ready) return <div className="center">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;
  const logout = () => { session.set(null); setUser(null); };
  const pages = PAGES.filter(([k]) => canSee(user, k));
  return (
    <div className="shell">
      <header className="top">
        <button className="burger" onClick={() => setMenu(!menu)} aria-label="menu">☰</button>
        <b>MAMS</b><span className="grow" />
        <span className="who">{user.full_name} · <em>{user.role.replace('_', ' ')}</em></span>
        <button className="ghost" onClick={logout}>Logout</button>
      </header>
      <nav className={menu ? 'open' : ''}>
        {pages.map(([k, l]) => <a key={k} className={page === k ? 'on' : ''} onClick={() => { setPage(k); setMenu(false); }}>{l}</a>)}
      </nav>
      <main>
        {page === 'dashboard' && <Dashboard user={user} />}
        {page === 'purchases' && <Purchases user={user} />}
        {page === 'transfers' && <Transfers user={user} />}
        {page === 'assignments' && <AssignExpend user={user} />}
        {page === 'audit' && <Audit />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [f, setF] = useState({ username: '', password: '' }), [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { const r = await api('/api/auth/login', { method: 'POST', body: f }); session.set(r.token); onLogin(r.user); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="center"><form className="card login" onSubmit={submit}>
      <h2>Military Asset Management</h2>
      <input placeholder="Username" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoFocus />
      <input placeholder="Password" type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      {err && <p className="err">{err}</p>}
      <button>Sign in</button>
      <small>Demo: admin / Admin@123 · commander.alpha / Commander@123 · logistics.alpha / Logistics@123</small>
    </form></div>
  );
}

/* ---- shared hooks / widgets ---- */
function useLookups() {
  const [bases, setBases] = useState([]), [types, setTypes] = useState([]);
  useEffect(() => { api('/api/bases').then(setBases); api('/api/equipment-types').then(setTypes); }, []);
  return { bases, types };
}
const Select = ({ label, value, onChange, options, all }) => (
  <label>{label}<select value={value} onChange={e => onChange(e.target.value)}>
    {all && <option value="">{all}</option>}{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
);
function Filters({ f, setF, user, bases, types }) {
  return (
    <div className="filters card">
      <label>From<input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></label>
      <label>To<input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></label>
      {user.role === 'admin' && <Select label="Base" all="All bases" value={f.base_id} onChange={v => setF({ ...f, base_id: v })} options={bases} />}
      <Select label="Equipment type" all="All types" value={f.type_id} onChange={v => setF({ ...f, type_id: v })} options={types} />
    </div>
  );
}
const Modal = ({ title, onClose, children }) => (
  <div className="modal" onClick={onClose}><div className="card" onClick={e => e.stopPropagation()}>
    <div className="row"><h3>{title}</h3><span className="grow" /><button className="ghost" onClick={onClose}>✕</button></div>{children}</div></div>
);
const Table = ({ cols, rows }) => (
  <div className="scroll"><table><thead><tr>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((r, i) => <tr key={r.id ?? i}>{cols.map(([k, h]) => <td key={h}>{r[k] ?? '—'}</td>)}</tr>) : <tr><td colSpan={cols.length} className="muted">No records</td></tr>}</tbody></table></div>
);

/* ---- Dashboard ---- */
function Dashboard({ user }) {
  const { bases, types } = useLookups();
  const [f, setF] = useState({ from: '', to: '', base_id: '', type_id: '' }), [d, setD] = useState(null), [err, setErr] = useState(''), [pop, setPop] = useState(false);
  useEffect(() => { api('/api/dashboard' + qs(f)).then(setD).catch(e => setErr(e.message)); }, [f]);
  const T = d?.totals || {};
  const tiles = [['Opening Balance', T.opening], ['Net Movement', T.net_movement, true], ['Assigned', T.assigned], ['Expended', T.expended], ['Closing Balance', T.closing]];
  return (<>
    <h2>Dashboard</h2>
    <Filters {...{ f, setF, user, bases, types }} />
    {err && <p className="err">{err}</p>}
    <div className="tiles">{tiles.map(([l, v, click]) =>
      <div key={l} className={'tile card' + (click ? ' click' : '')} onClick={click ? () => setPop(true) : undefined}><small>{l}{click && ' ⓘ'}</small><b>{v ?? 0}</b></div>)}</div>
    <div className="card"><h3>Balances by base &amp; equipment</h3>
      <Table cols={[['base', 'Base'], ['type', 'Equipment'], ['opening', 'Opening'], ['purchases', 'Purchases'], ['transfer_in', 'Transfer In'], ['transfer_out', 'Transfer Out'], ['net_movement', 'Net'], ['assigned', 'Assigned'], ['expended', 'Expended'], ['closing', 'Closing']]} rows={d?.rows || []} /></div>
    {pop && d && <Modal title="Net Movement breakdown" onClose={() => setPop(false)}>
      <p className="muted">Purchases {T.purchases} + Transfer In {T.transfer_in} − Transfer Out {T.transfer_out} = <b>{T.net_movement}</b></p>
      <h4>Purchases</h4><Table cols={[['date', 'Date'], ['base', 'Base'], ['type', 'Equipment'], ['quantity', 'Qty']]} rows={d.detail.purchases} />
      <h4>Transfers In</h4><Table cols={[['date', 'Date'], ['from_base', 'From'], ['to_base', 'To'], ['type', 'Equipment'], ['quantity', 'Qty']]} rows={d.detail.transfer_in} />
      <h4>Transfers Out</h4><Table cols={[['date', 'Date'], ['from_base', 'From'], ['to_base', 'To'], ['type', 'Equipment'], ['quantity', 'Qty']]} rows={d.detail.transfer_out} />
    </Modal>}
  </>);
}

/* ---- generic "form + history" page ---- */
function CrudPage({ title, resource, user, fields, cols, filterable = true, initial = {} }) {
  const { bases, types } = useLookups();
  const [f, setF] = useState({ from: '', to: '', base_id: '', type_id: '' }), [rows, setRows] = useState([]);
  const [form, setForm] = useState({ base_id: user.base_id || '', equipment_type_id: '', quantity: '', ...initial }), [msg, setMsg] = useState(null);
  const load = useCallback(() => api(`/api/${resource}` + qs(f)).then(setRows).catch(e => setMsg({ err: e.message })), [f, resource]);
  useEffect(() => { load(); }, [load]);
  const submit = async e => {
    e.preventDefault(); setMsg(null);
    try { await api(`/api/${resource}`, { method: 'POST', body: form }); setMsg({ ok: 'Recorded' }); setForm({ ...form, quantity: '' }); load(); } catch (x) { setMsg({ err: x.message }); }
  };
  const baseOpts = user.role === 'admin' ? bases : bases.filter(b => b.id === user.base_id);
  return (<>
    <h2>{title}</h2>
    <form className="card formgrid" onSubmit={submit}>
      <Select label={fields.baseLabel || 'Base'} value={form.base_id} onChange={v => setForm({ ...form, base_id: v })} options={baseOpts} all="Select…" />
      {fields.to && <Select label="Destination base" value={form.to_base_id || ''} onChange={v => setForm({ ...form, to_base_id: v })} options={bases.filter(b => String(b.id) !== String(form.base_id))} all="Select…" />}
      <Select label="Equipment type" value={form.equipment_type_id} onChange={v => setForm({ ...form, equipment_type_id: v })} options={types} all="Select…" />
      <label>Quantity<input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label>
      {fields.text?.map(([k, l]) => <label key={k}>{l}<input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></label>)}
      <label>Date<input type="date" value={form[fields.date] || ''} onChange={e => setForm({ ...form, [fields.date]: e.target.value })} /></label>
      <button>Submit</button>
      {msg?.err && <p className="err">{msg.err}</p>}{msg?.ok && <p className="ok">{msg.ok}</p>}
    </form>
    {filterable && <Filters {...{ f, setF, user, bases, types }} />}
    <div className="card"><Table cols={cols} rows={rows} /></div>
  </>);
}
const Purchases = ({ user }) => <CrudPage title="Purchases" resource="purchases" user={user}
  fields={{ text: [['supplier', 'Supplier'], ['unit_cost', 'Unit cost']], date: 'purchased_at' }}
  cols={[['purchased_at', 'Date'], ['base', 'Base'], ['type', 'Equipment'], ['quantity', 'Qty'], ['supplier', 'Supplier'], ['by', 'Recorded by']]} />;
const Transfers = ({ user }) => <CrudPage title="Transfers" resource="transfers" user={user}
  fields={{ baseLabel: 'From base', to: true, text: [['note', 'Note']], date: 'transferred_at' }}
  cols={[['transferred_at', 'Date'], ['from_base', 'From'], ['to_base', 'To'], ['type', 'Equipment'], ['quantity', 'Qty'], ['note', 'Note'], ['by', 'By'], ['created_at', 'Timestamp']]} />;

function AssignExpend({ user }) {
  const [tab, setTab] = useState(user.permissions.assignments ? 'assignments' : 'expenditures');
  return (<>
    <div className="tabs"><a className={tab === 'assignments' ? 'on' : ''} onClick={() => setTab('assignments')}>Assignments</a>
      <a className={tab === 'expenditures' ? 'on' : ''} onClick={() => setTab('expenditures')}>Expenditures</a></div>
    {tab === 'assignments'
      ? <CrudPage key="a" title="Assign assets to personnel" resource="assignments" user={user} fields={{ text: [['assigned_to', 'Assigned to']], date: 'assigned_at' }}
          cols={[['assigned_at', 'Date'], ['base', 'Base'], ['type', 'Equipment'], ['quantity', 'Qty'], ['assigned_to', 'Assigned to'], ['by', 'By']]} />
      : <CrudPage key="e" title="Expended assets" resource="expenditures" user={user} fields={{ text: [['reason', 'Reason']], date: 'expended_at' }}
          cols={[['expended_at', 'Date'], ['base', 'Base'], ['type', 'Equipment'], ['quantity', 'Qty'], ['reason', 'Reason'], ['by', 'By']]} />}
  </>);
}

function Audit() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/api/audit-log?limit=200').then(setRows); }, []);
  return (<><h2>Audit Log</h2><div className="card"><Table cols={[['created_at', 'Time'], ['username', 'User'], ['method', 'Method'], ['path', 'Path'], ['status', 'Status'], ['payload', 'Payload']]} rows={rows} /></div></>);
}
