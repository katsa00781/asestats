// Egyszeri backfill: a games.kosarstat_game_id kitöltése a már beimportált
// kosarstat_game_pages_raw metadata (match_date + csapatnevek) alapján.
// Futtatás: npx tsx scripts/backfill-kosarstat-game-links.ts [--season 2025/2026]
// A friss importoknál ezt már a scrape-kosarstat-playbyplay.ts automatikusan
// elvégzi – ez a script csak a meglévő sorok pótlására való.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Hiányzó Supabase env változók (.env.local).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const namesLooselyMatch = (a: string, b: string) => {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const readSeasonArg = () => {
  const index = process.argv.findIndex(arg => arg === '--season');
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1].trim();
  const withEquals = process.argv.find(arg => arg.startsWith('--season='));
  if (withEquals) return withEquals.slice('--season='.length).trim();
  return null;
};

const main = async () => {
  const seasonName = readSeasonArg();

  let seasonFilter: string | null = null;
  if (seasonName) {
    const { data: season, error } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('name', seasonName)
      .maybeSingle();
    if (error || !season) {
      console.error(`Szezon nem található: ${seasonName}`);
      process.exit(1);
    }
    seasonFilter = season.id;
    console.log(`Szezon: ${season.name} (${season.id})`);
  }

  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name, short_name');
  if (teamsError) {
    console.error('Teams lekérdezési hiba:', teamsError.message);
    process.exit(1);
  }
  const teamNames = new Map(
    (teams || []).map(row => [
      String(row.id),
      { name: String(row.name || ''), shortName: row.short_name ? String(row.short_name) : null },
    ])
  );

  let rawQuery = supabase
    .from('kosarstat_game_pages_raw')
    .select('season_id, kosarstat_game_id, match_date, home_team_name, away_team_name')
    .not('match_date', 'is', null)
    .not('home_team_name', 'is', null)
    .not('away_team_name', 'is', null);
  if (seasonFilter) rawQuery = rawQuery.eq('season_id', seasonFilter);

  const { data: rawPages, error: rawError } = await rawQuery;
  if (rawError) {
    console.error('Raw pages lekérdezési hiba:', rawError.message);
    process.exit(1);
  }

  // Egy meccshez több page-type sor tartozik – kosarstat_game_id szerint dedupolunk.
  const uniqueGames = new Map<string, { seasonId: string; matchDate: string; home: string; away: string }>();
  (rawPages || []).forEach(row => {
    const gameId = String(row.kosarstat_game_id || '').trim();
    if (!gameId || uniqueGames.has(gameId)) return;
    uniqueGames.set(gameId, {
      seasonId: String(row.season_id),
      matchDate: String(row.match_date).slice(0, 10),
      home: String(row.home_team_name || ''),
      away: String(row.away_team_name || ''),
    });
  });

  console.log(`${uniqueGames.size} kosarstat meccs metadata feldolgozása...`);

  let linked = 0;
  let alreadyLinked = 0;
  let unmatched = 0;
  let conflicts = 0;

  for (const [gameId, meta] of uniqueGames) {
    const { data: candidates, error } = await supabase
      .from('games')
      .select('id, our_team_id, opponent, kosarstat_game_id')
      .eq('season_id', meta.seasonId)
      .eq('date', meta.matchDate);

    if (error) {
      console.warn(`Lookup hiba (${gameId}): ${error.message}`);
      continue;
    }

    const home = normalizeText(meta.home);
    const away = normalizeText(meta.away);

    const matched = (candidates || []).filter(candidate => {
      const teamEntry = teamNames.get(String(candidate.our_team_id || ''));
      if (!teamEntry) return false;
      const ourName = normalizeText(teamEntry.name);
      const ourShort = normalizeText(teamEntry.shortName || '');
      const oppName = normalizeText(String(candidate.opponent || ''));
      const ourMatchesHome = namesLooselyMatch(ourName, home) || namesLooselyMatch(ourShort, home);
      const ourMatchesAway = namesLooselyMatch(ourName, away) || namesLooselyMatch(ourShort, away);
      return (
        (ourMatchesHome && namesLooselyMatch(oppName, away)) ||
        (ourMatchesAway && namesLooselyMatch(oppName, home))
      );
    });

    if (matched.length === 0) {
      console.warn(`⚠️ Nincs párosítás: ${gameId} (${meta.matchDate}, ${meta.home} vs ${meta.away})`);
      unmatched += 1;
      continue;
    }

    for (const candidate of matched) {
      const existing = String(candidate.kosarstat_game_id || '').trim();
      if (existing === gameId) {
        alreadyLinked += 1;
        continue;
      }
      if (existing) {
        console.warn(`⚠️ Ütközés: games.id=${candidate.id} már ${existing}-hez kötött (új: ${gameId}) – kihagyva.`);
        conflicts += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update({ kosarstat_game_id: gameId })
        .eq('id', candidate.id);

      if (updateError) {
        console.warn(`Update hiba (games.id=${candidate.id}): ${updateError.message}`);
      } else {
        console.log(`🔗 games.id=${candidate.id} → ${gameId} (${meta.matchDate})`);
        linked += 1;
      }
    }
  }

  console.log('--- Összegzés ---');
  console.log(`Új linkelés: ${linked}`);
  console.log(`Már linkelt: ${alreadyLinked}`);
  console.log(`Nem párosítható: ${unmatched}`);
  console.log(`Ütközés (kihagyva): ${conflicts}`);
};

main().catch(err => {
  console.error('Backfill hiba:', err);
  process.exit(1);
});
