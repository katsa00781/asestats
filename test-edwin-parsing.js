// Edwin adat szimulációja

const parts = [
  '0',  // mezszám
  'Edwin Deon Javern',  // név
  '4',   // pont
  '22',  // perc
  '1', '3', '33.3',  // közeli
  '1', '2', '50',    // közép
  '0', '0', '0',     // hármas
  '0', '1', '0',     // büntető
  '0', '0', '0',     // lepattanó (V, T, Ö)
  '0',  // SZ (steals)
  '2',  // EL (turnovers)
  '3',  // SA (assists)
  '1',  // KI (fouls)
  '1',  // SA oszlop (skip)
  '0',  // Blokk
  '0',  // +/-
  '0',  // VAL
  '68.9',   // O.RTG
  '104.5',  // D.RTG
  '40',     // TS%
  '40'      // ES%
];

console.log('Edwin import teszt:');
console.log('Mezszám:', parts[0]);
console.log('Név:', parts[1]);
console.log('Pontok:', parts[2]);
console.log('Percek:', parts[3]);
console.log('Összes TAB rész:', parts.length);

// Szimuláljuk a parsing-ot
let idx = 2;
const points = parseInt(parts[idx++]) || 0;
const minutes = parseInt(parts[idx++]) || 0;

const closeMade = parseInt(parts[idx++]) || 0;
const closeAttempted = parseInt(parts[idx++]) || 0;
idx++; // %

const midMade = parseInt(parts[idx++]) || 0;
const midAttempted = parseInt(parts[idx++]) || 0;
idx++; // %

const threeMade = parseInt(parts[idx++]) || 0;
const threeAttempted = parseInt(parts[idx++]) || 0;
idx++; // %

const ftMade = parseInt(parts[idx++]) || 0;
const ftAttempted = parseInt(parts[idx++]) || 0;
idx++; // %

const defensiveRebounds = parseInt(parts[idx++]) || 0;
const offensiveRebounds = parseInt(parts[idx++]) || 0;
const totalRebounds = parseInt(parts[idx++]) || 0;

const steals = parseInt(parts[idx++]) || 0;
const turnovers = parseInt(parts[idx++]) || 0;
const assists = parseInt(parts[idx++]) || 0;
const fouls = parseInt(parts[idx++]) || 0;
idx++; // SA oszlop skip
const blocks = parseInt(parts[idx++]) || 0;
const plusMinus = parseInt(parts[idx++]) || 0;
const valuation = parseInt(parts[idx++]) || 0;

const offensiveRating = parseFloat(parts[idx++]) || 0;
const defensiveRating = parseFloat(parts[idx++]) || 0;
const trueShootingPct = parseFloat(parts[idx++]) || 0;
const effectiveFGPct = parseFloat(parts[idx++]) || 0;

console.log('\nParsing eredmények:');
console.log('Points:', points);
console.log('Minutes:', minutes);
console.log('Close:', closeMade, '/', closeAttempted);
console.log('Mid:', midMade, '/', midAttempted);
console.log('Three:', threeMade, '/', threeAttempted);
console.log('FT:', ftMade, '/', ftAttempted);
console.log('Rebounds:', offensiveRebounds, '/', defensiveRebounds, '/', totalRebounds);
console.log('Assists:', assists);
console.log('Steals:', steals);
console.log('Turnovers:', turnovers);
console.log('Blocks:', blocks);
console.log('Fouls:', fouls);
console.log('Valuation:', valuation);
console.log('OffRtg:', offensiveRating);
console.log('DefRtg:', defensiveRating);
console.log('TS%:', trueShootingPct);
console.log('eFG%:', effectiveFGPct);

console.log('\nVégső idx pozíció:', idx, '/ Összes elem:', parts.length);
