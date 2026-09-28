BEGIN TRANSACTION;
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), assigned_to TEXT NOT NULL,
  assigned_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO "assignments" VALUES(1,1,3,40,'Alpha Company','2026-08-01',2,'2026-09-28 16:05:37');
INSERT INTO "assignments" VALUES(2,2,4,20,'Bravo Patrol Unit','2026-09-01',3,'2026-09-28 16:05:37');
INSERT INTO "assignments" VALUES(3,1,1,2,'Sgt. J. Rivera','2026-09-14',2,'2026-09-28 16:05:37');
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), username TEXT,
  method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL,
  payload TEXT, ip TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE bases (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, location TEXT);
INSERT INTO "bases" VALUES(1,'Fort Alpha','North Sector');
INSERT INTO "bases" VALUES(2,'Camp Bravo','East Sector');
INSERT INTO "bases" VALUES(3,'Base Charlie','South Sector');
CREATE TABLE equipment_types (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('vehicle','weapon','ammunition')));
INSERT INTO "equipment_types" VALUES(1,'Armored Personnel Carrier','vehicle');
INSERT INTO "equipment_types" VALUES(2,'Transport Truck','vehicle');
INSERT INTO "equipment_types" VALUES(3,'Service Rifle','weapon');
INSERT INTO "equipment_types" VALUES(4,'Sidearm','weapon');
INSERT INTO "equipment_types" VALUES(5,'5.56mm Rounds (box of 1000)','ammunition');
INSERT INTO "equipment_types" VALUES(6,'9mm Rounds (box of 1000)','ammunition');
CREATE TABLE expenditures (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), reason TEXT,
  expended_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO "expenditures" VALUES(1,1,5,120,'Range qualification','2026-08-20',2,'2026-09-28 16:05:37');
INSERT INTO "expenditures" VALUES(2,2,4,2,'Decommissioned','2026-09-15',3,'2026-09-28 16:05:37');
INSERT INTO "expenditures" VALUES(3,3,6,40,'Training','2026-09-18',1,'2026-09-28 16:05:37');
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY, base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), unit_cost REAL, supplier TEXT,
  purchased_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO "purchases" VALUES(1,1,1,10,450000.0,'Defence Motors','2026-06-05',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(2,1,3,200,1200.0,'Arms Depot','2026-06-10',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(3,1,5,500,900.0,'Munitions Co','2026-06-12',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(4,2,2,25,80000.0,'Defence Motors','2026-06-08',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(5,2,4,80,600.0,'Arms Depot','2026-06-15',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(6,3,6,300,700.0,'Munitions Co','2026-06-20',1,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(7,1,1,4,455000.0,'Defence Motors','2026-09-02',2,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(8,1,5,150,910.0,'Munitions Co','2026-09-05',4,'2026-09-28 16:05:37');
INSERT INTO "purchases" VALUES(9,2,3,60,1250.0,'Arms Depot','2026-09-09',5,'2026-09-28 16:05:37');
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY, from_base_id INTEGER NOT NULL REFERENCES bases(id),
  to_base_id INTEGER NOT NULL REFERENCES bases(id),
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0), note TEXT,
  transferred_at TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (from_base_id <> to_base_id));
INSERT INTO "transfers" VALUES(1,1,2,1,3,'Rotation','2026-07-15',1,'2026-09-28 16:05:37');
INSERT INTO "transfers" VALUES(2,1,3,3,50,'Reinforcement','2026-09-03',2,'2026-09-28 16:05:37');
INSERT INTO "transfers" VALUES(3,2,1,2,5,'Logistics support','2026-09-10',3,'2026-09-28 16:05:37');
INSERT INTO "transfers" VALUES(4,1,3,5,100,'Training exercise','2026-09-12',4,'2026-09-28 16:05:37');
CREATE TABLE users (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','base_commander','logistics_officer')),
  base_id INTEGER REFERENCES bases(id),
  CHECK (role = 'admin' OR base_id IS NOT NULL));
INSERT INTO "users" VALUES(1,'admin','9981903a1532e4ec2420b3cb78db63e4:5078142fc4f38ff2ef67eb51a8fa4e6f44a3801778c1c1b82ac2fdd249064700a92348150d690502863dce0eee8c4df86351d4edda00b33701cdb13d1fda6cd2','System Administrator','admin',NULL);
INSERT INTO "users" VALUES(2,'commander.alpha','13ea4e80cdf1e169ff327cb47cc5e92d:7ca44b946872f891e94b838bfee9c6920a98512b87ac05dde2f5b55800426bc1c65c6b4df01ac3fb138d882cfe992ce25414a44fcaf734282ca62e86592863c4','Col. Ray Mason','base_commander',1);
INSERT INTO "users" VALUES(3,'commander.bravo','9edb1ea029d8f92390a31b18930bd11e:900a501ad6196330c5d65c4ebec536702051334492d3f64c64ea2bad5c1e5f5e92405ddf7e2ccc337346c1d05836180e15d962ba49183cd4b8c409ed4936b238','Col. Dana Ortiz','base_commander',2);
INSERT INTO "users" VALUES(4,'logistics.alpha','dff4e610c3e2075619c691988a45351e:17bd35bf04c7b88d4c1b5f8df305b594f492b2bc70d12f8ef2a44eed4847dfd06128aadaa09b8a1232a9944247415e327f96b2fa29bbbd5b6419051c25a1f26b','Lt. Sam Keller','logistics_officer',1);
INSERT INTO "users" VALUES(5,'logistics.bravo','f90acc3672dad47224a83b9f47feb9ac:22fde92ff67f332b50c3b19b9992130816f17d02018748eb0884acd2ddbce543140d1be0622c32a4865e4db2dc8ad567caec17df5190239276f6129f7aca11e8','Lt. Mia Novak','logistics_officer',2);
CREATE INDEX ix_pur ON purchases(base_id, equipment_type_id, purchased_at);
CREATE INDEX ix_trf_from ON transfers(from_base_id, equipment_type_id, transferred_at);
CREATE INDEX ix_trf_to ON transfers(to_base_id, equipment_type_id, transferred_at);
CREATE INDEX ix_asg ON assignments(base_id, equipment_type_id, assigned_at);
CREATE INDEX ix_exp ON expenditures(base_id, equipment_type_id, expended_at);
CREATE INDEX ix_audit ON audit_log(created_at);
COMMIT;
