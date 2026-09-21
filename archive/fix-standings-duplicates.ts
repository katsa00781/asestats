// Egyszeri adattisztítás: a standings.data JSON tömbökből eltávolítja a
// duplikált csapatsorokat.
//
// Ok: a hunbasket tabella oldal ugyanazt a 14 csapatsort kétszer rendereli
// egyetlen <table>-ben (asztali + mobil változat), és a scrape-hunbasket-standings.ts
// 2026-09-21 előtt dedup nélkül mentette mind a 28 sort. A scraper már deduplikál
// (dedupeByPosition), ez a szkript a korábban mentett rekordokat hozza rendbe.
//
// Futtatás (előbb mindig dry-run):
//   npx tsx archive/fix-standings-duplicates.ts
//   STANDINGS_FIX_APPLY=1 npx tsx archive/fix-standings-duplicates.ts

import { createScriptClient, normalizeName } from '../scrape-utils';

const apply = process.env.STANDINGS_FIX_APPLY === '1';
const supabase = createScriptClient();

type StandingRow = { position: number; team: string };

const dedupe = (rows: StandingRow[]) => {
  const byPosition = new Map<number, StandingRow>();
  for (const row of rows) {
    const existing = byPosition.get(row.position);
    if (!existing) {
      byPosition.set(row.position, row);
      continue;
    }
    if (normalizeName(existing.team) !== normalizeName(row.team)) {
      throw new Error(`Eltérő csapat azonos pozíción (${row.position}): "${existing.team}" vs "${row.team}"`);
    }
  }
  return [...byPosition.values()].sort((a, b) => a.position - b.position);
};

const main = async () => {
  const { data, error } = await supabase
    .from('standings')
    .select('id, season_id, matchday, date, data')
    .order('date', { ascending: false });
  if (error) throw error;

  console.log(`Standings rekordok: ${data?.length ?? 0}${apply ? '' : ' (DRY-RUN, írás nincs)'}`);
  let changed = 0;

  for (const record of data ?? []) {
    const rows = Array.isArray(record.data) ? (record.data as StandingRow[]) : [];
    if (rows.length === 0) {
      console.log(`  matchday=${record.matchday} ${record.date}: üres data – kihagyva`);
      continue;
    }

    const unique = dedupe(rows);
    if (unique.length === rows.length) {
      console.log(`  matchday=${record.matchday} ${record.date}: ${rows.length} sor – rendben`);
      continue;
    }

    console.log(`  matchday=${record.matchday} ${record.date}: ${rows.length} → ${unique.length} sor`);
    changed += 1;

    if (apply) {
      const { error: updateError } = await supabase
        .from('standings')
        .update({ data: unique, updated_at: new Date().toISOString() })
        .eq('id', record.id);
      if (updateError) throw new Error(`Mentési hiba (${record.id}): ${updateError.message}`);
    }
  }

  console.log(`\nÉrintett rekord: ${changed}${apply ? ' – frissítve.' : ' – futtasd STANDINGS_FIX_APPLY=1 környezeti változóval a javításhoz.'}`);
};

main().catch(err => {
  console.error('Standings dedup hiba:', err);
  process.exit(1);
});
