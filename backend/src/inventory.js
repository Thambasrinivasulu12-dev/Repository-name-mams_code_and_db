const { db } = require('./db');

/**
 * Balance rules (per base + equipment type, for a period [from, to]):
 *   opening  = stock before `from`  = P + TI - TO - E   (all events dated < from)
 *   net move = purchases + transfers_in - transfers_out (events within period)
 *   expended = expenditures within period
 *   closing  = opening + net movement - expended
 *   assigned = assignments in period (assets stay on base books, issued to personnel)
 */
const SUMS = `
 SELECT b.id base_id, b.name base, t.id type_id, t.name type, t.category,
  COALESCE((SELECT SUM(quantity) FROM purchases  WHERE base_id=b.id AND equipment_type_id=t.id AND purchased_at<:from),0)
 +COALESCE((SELECT SUM(quantity) FROM transfers  WHERE to_base_id=b.id AND equipment_type_id=t.id AND transferred_at<:from),0)
 -COALESCE((SELECT SUM(quantity) FROM transfers  WHERE from_base_id=b.id AND equipment_type_id=t.id AND transferred_at<:from),0)
 -COALESCE((SELECT SUM(quantity) FROM expenditures WHERE base_id=b.id AND equipment_type_id=t.id AND expended_at<:from),0) AS opening,
  COALESCE((SELECT SUM(quantity) FROM purchases  WHERE base_id=b.id AND equipment_type_id=t.id AND purchased_at BETWEEN :from AND :to),0) AS purchases,
  COALESCE((SELECT SUM(quantity) FROM transfers  WHERE to_base_id=b.id AND equipment_type_id=t.id AND transferred_at BETWEEN :from AND :to),0) AS transfer_in,
  COALESCE((SELECT SUM(quantity) FROM transfers  WHERE from_base_id=b.id AND equipment_type_id=t.id AND transferred_at BETWEEN :from AND :to),0) AS transfer_out,
  COALESCE((SELECT SUM(quantity) FROM assignments WHERE base_id=b.id AND equipment_type_id=t.id AND assigned_at BETWEEN :from AND :to),0) AS assigned,
  COALESCE((SELECT SUM(quantity) FROM expenditures WHERE base_id=b.id AND equipment_type_id=t.id AND expended_at BETWEEN :from AND :to),0) AS expended
 FROM bases b CROSS JOIN equipment_types t`;

function balances({ from = '0000-01-01', to = '9999-12-31', baseId, typeId }) {
  const rows = db.prepare(SUMS).all({ from, to });
  return rows.filter(r => (!baseId || r.base_id === +baseId) && (!typeId || r.type_id === +typeId))
    .map(r => ({ ...r, net_movement: r.purchases + r.transfer_in - r.transfer_out,
      closing: r.opening + r.purchases + r.transfer_in - r.transfer_out - r.expended }))
    .filter(r => r.opening || r.purchases || r.transfer_in || r.transfer_out || r.assigned || r.expended);
}
// Current on-hand stock of one type at one base (used to block over-issuing)
function onHand(baseId, typeId) {
  const r = balances({ baseId, typeId })[0];
  return r ? r.closing : 0;
}
module.exports = { balances, onHand };
