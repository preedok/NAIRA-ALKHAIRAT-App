'use strict';

/**
 * Penalti Bus Finality: dikenakan untuk pack visa DI BAWAH minimum (bus_min_pack, default 35).
 * Jumlah pack kena penalti = max(0, minPack - totalVisaPacks); nominal = itu × bus_penalty_idr.
 * Opsi hiace / visa_only / waive → 0.
 */
function computeBusFinalityPenaltyIdr({
  busServiceOption,
  waiveBusPenalty,
  totalVisaPacks,
  rules
}) {
  const opt = String(busServiceOption || '');
  if (opt === 'visa_only' || opt === 'hiace' || waiveBusPenalty) return 0;
  if (opt !== 'finality') return 0;
  const visa = Math.max(0, parseInt(totalVisaPacks, 10) || 0);
  if (visa <= 0) return 0;
  const minPack = Math.max(0, parseInt(rules?.bus_min_pack, 10) || 35);
  const perPack = parseFloat(rules?.bus_penalty_idr) || 500000;
  const deficitPacks = Math.max(0, minPack - visa);
  return deficitPacks * perPack;
}

function busFinalityDeficitPacks(totalVisaPacks, rules) {
  const visa = Math.max(0, parseInt(totalVisaPacks, 10) || 0);
  const minPack = Math.max(0, parseInt(rules?.bus_min_pack, 10) || 35);
  return Math.max(0, minPack - visa);
}

module.exports = { computeBusFinalityPenaltyIdr, busFinalityDeficitPacks };
