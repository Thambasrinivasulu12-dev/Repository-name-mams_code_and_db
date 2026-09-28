const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const session = {
  get token() { return sessionStorage.getItem('mams_token'); },
  set(t) { t ? sessionStorage.setItem('mams_token', t) : sessionStorage.removeItem('mams_token'); },
};
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(session.token && { Authorization: 'Bearer ' + session.token }) },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401) session.set(null); throw new Error(j.error || `Request failed (${r.status})`); }
  return j;
}
export const qs = o => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v)); const s = p.toString(); return s ? '?' + s : ''; };
