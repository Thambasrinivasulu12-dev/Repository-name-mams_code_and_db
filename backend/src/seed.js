// Usage: npm run seed   (idempotent: wipes and re-creates demo data)
const { db, hashPassword } = require('./db');
for (const t of ['audit_log','expenditures','assignments','transfers','purchases','users','equipment_types','bases']) db.exec(`DELETE FROM ${t}`);
const ins = (t, rows) => rows.forEach(r => { const k = Object.keys(r); db.prepare(`INSERT INTO ${t}(${k}) VALUES(${k.map(() => '?')})`).run(...Object.values(r)); });

ins('bases', [{ id: 1, name: 'Fort Alpha', location: 'North Sector' }, { id: 2, name: 'Camp Bravo', location: 'East Sector' }, { id: 3, name: 'Base Charlie', location: 'South Sector' }]);
ins('equipment_types', [
  { id: 1, name: 'Armored Personnel Carrier', category: 'vehicle' }, { id: 2, name: 'Transport Truck', category: 'vehicle' },
  { id: 3, name: 'Service Rifle', category: 'weapon' }, { id: 4, name: 'Sidearm', category: 'weapon' },
  { id: 5, name: '5.56mm Rounds (box of 1000)', category: 'ammunition' }, { id: 6, name: '9mm Rounds (box of 1000)', category: 'ammunition' }]);
const U = (id, username, pw, full_name, role, base_id) => ({ id, username, password_hash: hashPassword(pw), full_name, role, base_id });
ins('users', [
  U(1, 'admin', 'Admin@123', 'System Administrator', 'admin', null),
  U(2, 'commander.alpha', 'Commander@123', 'Col. Ray Mason', 'base_commander', 1),
  U(3, 'commander.bravo', 'Commander@123', 'Col. Dana Ortiz', 'base_commander', 2),
  U(4, 'logistics.alpha', 'Logistics@123', 'Lt. Sam Keller', 'logistics_officer', 1),
  U(5, 'logistics.bravo', 'Logistics@123', 'Lt. Mia Novak', 'logistics_officer', 2)]);
ins('purchases', [
  { base_id: 1, equipment_type_id: 1, quantity: 10, unit_cost: 450000, supplier: 'Defence Motors', purchased_at: '2026-06-05', created_by: 1 },
  { base_id: 1, equipment_type_id: 3, quantity: 200, unit_cost: 1200, supplier: 'Arms Depot', purchased_at: '2026-06-10', created_by: 1 },
  { base_id: 1, equipment_type_id: 5, quantity: 500, unit_cost: 900, supplier: 'Munitions Co', purchased_at: '2026-06-12', created_by: 1 },
  { base_id: 2, equipment_type_id: 2, quantity: 25, unit_cost: 80000, supplier: 'Defence Motors', purchased_at: '2026-06-08', created_by: 1 },
  { base_id: 2, equipment_type_id: 4, quantity: 80, unit_cost: 600, supplier: 'Arms Depot', purchased_at: '2026-06-15', created_by: 1 },
  { base_id: 3, equipment_type_id: 6, quantity: 300, unit_cost: 700, supplier: 'Munitions Co', purchased_at: '2026-06-20', created_by: 1 },
  { base_id: 1, equipment_type_id: 1, quantity: 4, unit_cost: 455000, supplier: 'Defence Motors', purchased_at: '2026-09-02', created_by: 2 },
  { base_id: 1, equipment_type_id: 5, quantity: 150, unit_cost: 910, supplier: 'Munitions Co', purchased_at: '2026-09-05', created_by: 4 },
  { base_id: 2, equipment_type_id: 3, quantity: 60, unit_cost: 1250, supplier: 'Arms Depot', purchased_at: '2026-09-09', created_by: 5 }]);
ins('transfers', [
  { from_base_id: 1, to_base_id: 2, equipment_type_id: 1, quantity: 3, note: 'Rotation', transferred_at: '2026-07-15', created_by: 1 },
  { from_base_id: 1, to_base_id: 3, equipment_type_id: 3, quantity: 50, note: 'Reinforcement', transferred_at: '2026-09-03', created_by: 2 },
  { from_base_id: 2, to_base_id: 1, equipment_type_id: 2, quantity: 5, note: 'Logistics support', transferred_at: '2026-09-10', created_by: 3 },
  { from_base_id: 1, to_base_id: 3, equipment_type_id: 5, quantity: 100, note: 'Training exercise', transferred_at: '2026-09-12', created_by: 4 }]);
ins('assignments', [
  { base_id: 1, equipment_type_id: 3, quantity: 40, assigned_to: 'Alpha Company', assigned_at: '2026-08-01', created_by: 2 },
  { base_id: 2, equipment_type_id: 4, quantity: 20, assigned_to: 'Bravo Patrol Unit', assigned_at: '2026-09-01', created_by: 3 },
  { base_id: 1, equipment_type_id: 1, quantity: 2, assigned_to: 'Sgt. J. Rivera', assigned_at: '2026-09-14', created_by: 2 }]);
ins('expenditures', [
  { base_id: 1, equipment_type_id: 5, quantity: 120, reason: 'Range qualification', expended_at: '2026-08-20', created_by: 2 },
  { base_id: 2, equipment_type_id: 4, quantity: 2, reason: 'Decommissioned', expended_at: '2026-09-15', created_by: 3 },
  { base_id: 3, equipment_type_id: 6, quantity: 40, reason: 'Training', expended_at: '2026-09-18', created_by: 1 }]);
console.log('Seeded demo data.');
