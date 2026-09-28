PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS bases (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, location TEXT);
CREATE TABLE IF NOT EXISTS equipment_types (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('vehicle','weapon','ammunition')));
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','base_commander','logistics_officer')),
  base_id INTEGER REFERENCES bases(id),
  CHECK (role = 'admin' OR base_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), unit_cost REAL, supplier TEXT,
  purchased_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY, from_base_id INTEGER NOT NULL REFERENCES bases(id),
  to_base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), note TEXT,
  transferred_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (from_base_id <> to_base_id));
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), assigned_to TEXT NOT NULL,
  assigned_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS expenditures (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), reason TEXT,
  expended_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), username TEXT,
  method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL,
  payload TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_pur ON purchases(base_id, equipment_type_id, purchased_at);
CREATE INDEX IF NOT EXISTS ix_trf_from ON transfers(from_base_id, equipment_type_id, transferred_at);
CREATE INDEX IF NOT EXISTS ix_trf_to ON transfers(to_base_id, equipment_type_id, transferred_at);
CREATE INDEX IF NOT EXISTS ix_asg ON assignments(base_id, equipment_type_id, assigned_at);
CREATE INDEX IF NOT EXISTS ix_exp ON expenditures(base_id, equipment_type_id, expended_at);
CREATE INDEX IF NOT EXISTS ix_audit ON audit_log(created_at);
