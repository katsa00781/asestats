// Egyszeri adattisztítás: üres DNP (0 perces) stat sorok eltávolítása.
//
// A box-score parser (scrape-hunbasket.ts) szándékosan kihagyja a 0 perces
// sorokat (`minutes === 0` -> continue), így a mai import ilyet nem ír. Egy
// korábbi importból viszont maradtak ilyen sorok, ami inkonzisztenssé teszi az
// adatot: a legtöbb meccsnél nincsenek DNP sorok, néhánynál igen.
//
// A meccsek nagy részét az újraimport már rendbe tette; itt azok maradtak,
// amelyek nincsenek rajta a bajnoki menetrenden (Magyar Kupa), ezért a
// box-score import nem éri el őket.
//
// Biztonsági feltétel: CSAK teljesen üres sort törlünk – 0 perc ÉS 0 pont ÉS
// 0 valuation. Ha bármelyik nem nulla, a sor marad és a szkript jelzi.
//
// Futtatás (előbb mindig dry-run):
//   npx tsx archive/fix-empty-dnp-stat-rows.ts
//   DNP_FIX_APPLY=1 npx tsx archive/fix-empty-dnp-stat-rows.ts

import { createScriptClient } from '../scrape-utils';
import { fetchAllRows } from '../lib/fetch-all-rows';

const apply = process.env.DNP_FIX_APPLY === '1';
const supabase = createScriptClient();

const TABLES = [
  'player_game_stats_2023_2024',
  'player_game_stats_2024_2025',
  'player_game_stats_2025_2026',
  'player_game_stats_2026_2027',
];

type Row = { id: string; game_id: string; minutes: number; points: number; valuation: number };

const main = async () => {
  console.log(`Üres DNP sorok tisztítása${apply ? '' : ' (DRY-RUN, törlés nincs)'}\n`);
  let totalDeleted = 0;
  let totalKept = 0;

  for (const table of TABLES) {
    const rows = await fetchAllRows<Row>((from, to) =>
      supabase.from(table).select('id, game_id, minutes, points, valuation').range(from, to));

    const zero = rows.filter(r => !r.minutes);
    const empty = zero.filter(r => (r.points ?? 0) === 0 && (r.valuation ?? 0) === 0);
    const nonEmpty = zero.filter(r => (r.points ?? 0) !== 0 || (r.valuation ?? 0) !== 0);

    console.log(`${table}: ${rows.length} sor, ebből 0 perces ${zero.length}`);
    if (nonEmpty.length > 0) {
      console.log(`   FIGYELEM: ${nonEmpty.length} db 0 perces sor NEM üres – ezek maradnak, kézi vizsgálat kell:`);
      for (const r of nonEmpty.slice(0, 10)) {
        console.log(`      id=${r.id} game=${r.game_id} pont=${r.points} valuation=${r.valuation}`);
      }
      totalKept += nonEmpty.length;
    }
    if (empty.length === 0) {
      console.log(`   törlendő: 0\n`);
      continue;
    }
    console.log(`   ${apply ? 'törölve' : 'törlendő'}: ${empty.length} (${new Set(empty.map(r => r.game_id)).size} meccsen)`);

    if (apply) {
      const ids = empty.map(r => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from(table).delete().in('id', ids.slice(i, i + 200));
        if (error) throw new Error(`Törlési hiba (${table}): ${error.message}`);
      }
    }
    totalDeleted += empty.length;
    console.log('');
  }

  console.log(`--- Összegzés ---`);
  console.log(`${apply ? 'Törölve' : 'Törlendő'}: ${totalDeleted} sor`);
  console.log(`Meghagyva (0 perc, de nem üres): ${totalKept}`);
  if (!apply && totalDeleted > 0) console.log(`\nA végrehajtáshoz: DNP_FIX_APPLY=1 npx tsx archive/fix-empty-dnp-stat-rows.ts`);
};

main().catch(err => {
  console.error('DNP tisztítási hiba:', err);
  process.exit(1);
});
