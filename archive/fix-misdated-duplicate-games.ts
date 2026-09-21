// Egyszeri adattisztítás: rossz dátum alatt megragadt, duplikált games sorok
// törlése a 2025/2026-os szezonból.
//
// Tünet: 3 games sornak olyan dátuma van, amelyen a menetrend szerint az adott
// csapat nem játszott, és a hozzájuk tartozó player_game_stats sorok NEM a
// games.our_team_id keretéhez tartoznak, hanem az ellenfélhez. A mérkőzés
// helyes dátum alatt, helyes kerettel külön games sorként is megvan.
//
// Keletkezés: egy korábbi import a menetrendben azóta javított dátummal írta be
// a meccset; a games UNIQUE (season_id, our_team_id, date) kulcs miatt az
// újraimport nem felülírta, hanem új sort hozott létre. A régi sor ottmaradt.
//
// A törlés CASCADE-el a player_game_stats_* táblákra. A szkript ezért minden
// sort csak akkor töröl, ha mind a négy feltétel teljesül:
//   1. a stat sorok NEM a games.our_team_id keretéhez tartoznak,
//   2. létezik ugyanERRE A MÉRKŐZÉSRE helyes games sor – azonos eredménnyel és
//      a saját keretével (az eredmény azonosítja a meccset, nem a dátum, mert
//      épp az a hibás; a puszta párosítás-egyezés kevés lenne, mert két csapat
//      szezononként kétszer is játszik egymással),
//   3. nincs rá kosarstat_game_id link,
//   4. nincs hozzá AI riport (game_text_reports / player_game_text_reports).
//
// Futtatás (előbb mindig dry-run):
//   npx tsx archive/fix-misdated-duplicate-games.ts
//   MISDATED_FIX_APPLY=1 npx tsx archive/fix-misdated-duplicate-games.ts

import { createScriptClient } from '../scrape-utils';
import { fetchAllRows } from '../lib/fetch-all-rows';

const apply = process.env.MISDATED_FIX_APPLY === '1';
const SEASON_ID = process.env.MISDATED_SEASON_ID || 'd80abb1c-e7b7-4290-88bd-62c9df93bf6f'; // 2025/2026
const STATS_TABLE = process.env.MISDATED_STATS_TABLE || 'player_game_stats_2025_2026';

const supabase = createScriptClient();

type GameRow = {
  id: string;
  our_team_id: string;
  opponent: string;
  date: string;
  our_score: number;
  opp_score: number;
  kosarstat_game_id: string | null;
};

const main = async () => {
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, name');
  if (teamsError) throw teamsError;
  const teamName = new Map((teams ?? []).map(t => [t.id, t.name]));

  const games = await fetchAllRows<GameRow>((from, to) =>
    supabase.from('games').select('id, our_team_id, opponent, date, our_score, opp_score, kosarstat_game_id')
      .eq('season_id', SEASON_ID).range(from, to));

  const stats = await fetchAllRows<{ game_id: string; player_id: string }>((from, to) =>
    supabase.from(STATS_TABLE).select('game_id, player_id').range(from, to));

  const playerIds = [...new Set(stats.map(s => s.player_id))];
  const playerTeam = new Map<string, string>();
  for (let i = 0; i < playerIds.length; i += 500) {
    const { data, error } = await supabase.from('players').select('id, team_id').in('id', playerIds.slice(i, i + 500));
    if (error) throw error;
    for (const p of data ?? []) playerTeam.set(p.id, p.team_id);
  }

  const statsByGame = new Map<string, string[]>();
  for (const s of stats) {
    if (!statsByGame.has(s.game_id)) statsByGame.set(s.game_id, []);
    statsByGame.get(s.game_id)!.push(s.player_id);
  }

  /** A sor kerete: az egyetlen csapat, amelyhez a stat sorok játékosai tartoznak. */
  const rosterTeam = (gameId: string): string | null => {
    const ids = statsByGame.get(gameId) ?? [];
    if (ids.length === 0) return null;
    const set = new Set(ids.map(id => playerTeam.get(id)).filter(Boolean));
    return set.size === 1 ? ([...set][0] as string) : null;
  };

  console.log(`Vizsgált games sorok: ${games.length}${apply ? '' : ' (DRY-RUN, törlés nincs)'}\n`);

  let deleted = 0;
  let skipped = 0;

  for (const game of games) {
    const roster = rosterTeam(game.id);
    if (!roster || roster === game.our_team_id) continue; // rendben lévő vagy üres sor

    const label = `${game.date} ${teamName.get(game.our_team_id)} vs ${game.opponent}`;
    const statCount = (statsByGame.get(game.id) ?? []).length;
    console.log(`GYANÚS: ${label} – ${statCount} stat sor, de a keret ${teamName.get(roster)}`);

    // 2. feltétel: ugyanaz a MÉRKŐZÉS meglegyen helyesen – az eredmény
    // azonosítja, mert a dátum épp a hibás mező.
    const correct = games.find(other =>
      other.id !== game.id &&
      other.our_team_id === roster &&
      other.our_score === game.our_score &&
      other.opp_score === game.opp_score &&
      rosterTeam(other.id) === roster);

    if (!correct) {
      console.log(`   KIHAGYVA: nincs azonos eredményű, helyes keretű megfelelője – az adat csak itt van meg.\n`);
      skipped += 1;
      continue;
    }
    console.log(`   Helyes megfelelő: ${correct.date} ${teamName.get(correct.our_team_id)} vs ${correct.opponent} ` +
      `(${correct.our_score}-${correct.opp_score}, ${(statsByGame.get(correct.id) ?? []).length} sor)`);

    // 3. feltétel
    if (game.kosarstat_game_id) {
      console.log(`   KIHAGYVA: kosarstat_game_id link van rajta (${game.kosarstat_game_id}).\n`);
      skipped += 1;
      continue;
    }

    // 4. feltétel
    const { count: reportCount, error: reportError } = await supabase
      .from('game_text_reports').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
    if (reportError) throw reportError;
    const { count: playerReportCount, error: playerReportError } = await supabase
      .from('player_game_text_reports').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
    if (playerReportError) throw playerReportError;

    if ((reportCount ?? 0) > 0 || (playerReportCount ?? 0) > 0) {
      console.log(`   KIHAGYVA: AI riport tartozik hozzá (${reportCount} + ${playerReportCount}).\n`);
      skipped += 1;
      continue;
    }

    if (apply) {
      const { error } = await supabase.from('games').delete().eq('id', game.id);
      if (error) throw new Error(`Törlési hiba (${game.id}): ${error.message}`);
      console.log(`   TÖRÖLVE (a ${statCount} stat sor CASCADE-del).\n`);
    } else {
      console.log(`   TÖRLENDŐ (a ${statCount} stat sor CASCADE-del).\n`);
    }
    deleted += 1;
  }

  console.log(`--- Összegzés ---`);
  console.log(`${apply ? 'Törölve' : 'Törlendő'}: ${deleted} games sor`);
  console.log(`Kihagyva (biztonsági feltétel miatt): ${skipped}`);
  if (!apply && deleted > 0) console.log(`\nA végrehajtáshoz: MISDATED_FIX_APPLY=1 npx tsx archive/fix-misdated-duplicate-games.ts`);
};

main().catch(err => {
  console.error('Tisztítási hiba:', err);
  process.exit(1);
});
