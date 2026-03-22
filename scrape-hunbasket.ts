/**
 * HUNBASKET.HU SCRAPER – teljes szezon importálása minden csapatra
 *
 * Használat:
 * 1. npm install
 * 2. npx playwright install chromium
 * 3. npx tsx scrape-hunbasket.ts
 *
 * Opcionális környezeti változók:
 * - HUNBASKET_SEASON_SLUG (alapértelmezett: x2526)
 * - HUNBASKET_SEASON_NAME (például: 2025/2026)
 * - HUNBASKET_SEASON_ID (ha megadod, nem keresünk név alapján)
 * - HUNBASKET_TEAM_FILTER (vesszővel elválasztott csapatlista részleges importhoz)
 * - HUNBASKET_ROUND_FILTER (pl. "5" vagy "3-5,12" a fordulók szűréséhez)
 * - HUNBASKET_HEADLESS=false (ha látni akarod a böngészőt futás közben)
 */

import { chromium, type Locator, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók! Kell NEXT_PUBLIC_SUPABASE_URL és legalább az anon vagy a service role kulcs.');
  process.exit(1);
}

const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const TEAM_FILTER = (process.env.HUNBASKET_TEAM_FILTER || '')
  .split(',')
  .map(team => team.trim())
  .filter(Boolean);
const parseRoundFilterInput = (value: string) => {
  const rounds = new Set<number>();
  value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(token => {
      const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          const [min, max] = start <= end ? [start, end] : [end, start];
          for (let current = min; current <= max; current += 1) {
            rounds.add(current);
          }
        }
        return;
      }

      const parsed = parseInt(token, 10);
      if (!Number.isNaN(parsed)) {
        rounds.add(parsed);
      }
    });

  return rounds;
};
const ROUND_FILTER = parseRoundFilterInput(process.env.HUNBASKET_ROUND_FILTER || '');
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

type ShotSplit = { made: number; attempted: number };

type PlayerStats = {
  number: number;
  name: string;
  minutes: number;
  points: number;
  closeShots: ShotSplit;
  midRangeShots: ShotSplit;
  threePointers: ShotSplit;
  freeThrows: ShotSplit;
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  fouls: number;
  valuation: number;
  advanced: {
    offensiveRating: number;
    defensiveRating: number;
    trueShootingPct: number;
    effectiveFGPct: number;
  };
};

type TeamGameImport = {
  teamName: string;
  opponentName: string;
  homeAway: 'home' | 'away';
  ourScore: number;
  oppScore: number;
  result: 'win' | 'loss';
  round: number | null;
  players: PlayerStats[];
};

type GameLink = {
  date: string;
  url: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  round: number | null;
};

type ScrapedGame = {
  date: string;
  round: number | null;
  teams: TeamGameImport[];
};

type TeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
  is_primary?: boolean | null;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();

const buildAbbreviation = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(token => (token.length <= 2 ? token : token[0]))
    .join('');

const cleanTeamName = (value: string) =>
  value
    .replace(/first teams logo|second teams logo|logo/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanPlayerName = (value: string) =>
  value
    .replace(/player avatar/gi, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseScore = (score: string) => {
  const cleaned = score.replace(/[^0-9–-]/g, '').replace(/–/g, '-');
  const [homeRaw, awayRaw] = cleaned.split('-');
  const homeScore = parseInt(homeRaw || '0', 10) || 0;
  const awayScore = parseInt((awayRaw || '0').trim(), 10) || 0;
  return { homeScore, awayScore };
};

const parseMinutes = (value: string) => {
  const [minutes] = value.split(/[:.]/);
  return parseInt(minutes || '0', 10) || 0;
};

const TEAM_FILTER_NORMALIZED = TEAM_FILTER.map(normalizeName).filter(Boolean);

const matchesRoundFilter = (round?: number | null) => {
  if (ROUND_FILTER.size === 0) return true;
  if (typeof round !== 'number' || Number.isNaN(round)) return false;
  return ROUND_FILTER.has(round);
};

const matchesFilter = (teamName: string) => {
  if (TEAM_FILTER_NORMALIZED.length === 0) return true;
  const normalized = normalizeName(teamName);
  return TEAM_FILTER_NORMALIZED.includes(normalized);
};

let cachedTeams: TeamRecord[] = [];

const refreshTeamCache = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name, is_primary')
    .order('name');

  if (error) {
    throw new Error(`Team cache betöltési hiba: ${error.message}`);
  }

  cachedTeams = data || [];
};

const findTeamInCache = (name: string) => {
  const normalizedTarget = normalizeName(name);
  if (!normalizedTarget) return undefined;

  return (
    cachedTeams.find(team => normalizeName(team.name) === normalizedTarget) ||
    cachedTeams.find(team => team.short_name && normalizeName(team.short_name) === normalizedTarget) ||
    cachedTeams.find(team => {
      const teamAbbr = buildAbbreviation(normalizeName(team.name));
      const targetAbbr = buildAbbreviation(normalizedTarget);
      return Boolean(teamAbbr) && teamAbbr === targetAbbr;
    })
  );
};

const ensureTeam = async (name: string): Promise<TeamRecord> => {
  const cleanedName = cleanTeamName(name);
  const existing = findTeamInCache(cleanedName);
  if (existing) return existing;

  const shortName = cleanedName.split(' ')[0] || cleanedName;
  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: cleanedName,
      short_name: shortName,
      is_primary: false,
    })
    .select('id, name, short_name, is_primary')
    .single();

  if (error || !data) {
    throw new Error(`Csapat létrehozási hiba (${cleanedName}): ${error?.message}`);
  }

  cachedTeams.push(data);
  console.log(`    🆕 Új csapat felvéve: ${data.name}`);
  return data;
};

const resolveSeasonId = async (): Promise<string> => {
  if (HUNBASKET_SEASON_ID) {
    const { data, error } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('id', HUNBASKET_SEASON_ID)
      .single();

    if (error || !data) {
      throw new Error(`Nem található szezon a megadott HUNBASKET_SEASON_ID alapján: ${HUNBASKET_SEASON_ID}`);
    }

    if (HUNBASKET_SEASON_NAME && data.name !== HUNBASKET_SEASON_NAME) {
      throw new Error(
        `HUNBASKET_SEASON_ID (${data.name}) nem egyezik a HUNBASKET_SEASON_NAME értékkel (${HUNBASKET_SEASON_NAME}). ` +
        'Frissítsd vagy töröld a HUNBASKET_SEASON_ID változót.'
      );
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', HUNBASKET_SEASON_NAME)
    .single();

  if (error || !data) {
    throw new Error(
      `Nem található "${HUNBASKET_SEASON_NAME}" szezon. Állítsd be a HUNBASKET_SEASON_ID változót, vagy hozd létre a szezont Supabase-ben.`
    );
  }

  return data.id;
};

const getGameLinks = async (page: Page): Promise<GameLink[]> => {
  console.log('📋 Meccslista letöltése...');
  await page.goto(`https://hunbasket.hu/menetrend-teljes/ferfi/${HUNBASKET_SEASON_SLUG}/hun`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const games = await page.$$eval('table tbody tr', rows => {
    const entries: { date: string; url: string; homeTeam: string; awayTeam: string; score: string; round: number | null }[] = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return;

      const roundText = (cells[0]?.textContent || '').trim();
      const roundMatch = roundText.match(/\d+/);
      const round = roundMatch ? parseInt(roundMatch[0] || '0', 10) || null : null;
      const homeTeam = (cells[1]?.textContent || '').trim();
      const scoreText = (cells[2]?.textContent || '').trim();
      const awayTeam = (cells[3]?.textContent || '').trim();
      const dateText = (cells[4]?.textContent || '').trim();
      const summaryLink = row.querySelector('a[href*="merkozes"]') as HTMLAnchorElement | null;

      if (!summaryLink) return;
      if (!scoreText.match(/\d+\s*[–-]\s*\d+/)) return;

      const dateMatch = dateText.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
      const isoDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : new Date().toISOString().split('T')[0];

      entries.push({
        date: isoDate,
        url: summaryLink.href,
        homeTeam,
        awayTeam,
        score: scoreText,
        round,
      });
    });

    return entries;
  });

  const filtered = games.filter(game => {
    if (!matchesRoundFilter(game.round)) return false;
    const { homeScore, awayScore } = parseScore(game.score);
    if (homeScore === 0 && awayScore === 0) return false;
    return matchesFilter(game.homeTeam) || matchesFilter(game.awayTeam);
  });

  const roundFilterLabel = ROUND_FILTER.size > 0 ? ` (${ROUND_FILTER.size} forduló szűrve)` : '';
  console.log(`✅ ${filtered.length} feldolgozható meccs találva${roundFilterLabel}`);
  return filtered;
};

const resolveTeamNames = async (page: Page, fallbackHome: string, fallbackAway: string) => {
  const anchors = await page.locator('a[href*="/csapat/"]').all();
  const names: string[] = [];

  for (const anchor of anchors) {
    const text = cleanTeamName((await anchor.textContent()) || '');
    if (text && !names.includes(text)) {
      names.push(text);
    }
    if (names.length === 2) break;
  }

  return {
    homeTeam: names[0] || cleanTeamName(fallbackHome),
    awayTeam: names[1] || cleanTeamName(fallbackAway),
  };
};

const collectStatTables = async (page: Page): Promise<Locator[]> => {
  const allTables = await page.locator('table').all();
  const statTables: Locator[] = [];

  for (const table of allTables) {
    const content = (await table.textContent()) || '';
    if (/Játékos/i.test(content) && /VAL/i.test(content)) {
      statTables.push(table);
    }
    if (statTables.length >= 2) break;
  }

  return statTables.length >= 2 ? statTables.slice(0, 2) : allTables.slice(0, 2);
};

const scrapePlayerTable = async (table: Locator): Promise<PlayerStats[]> => {
  const rows = await table.locator('tbody tr').all();
  const players: PlayerStats[] = [];

  for (const row of rows) {
    const cells = await row.locator('td').all();
    if (cells.length < 32) continue;

    const rawValues = await Promise.all(cells.map(cell => cell.textContent()));
    const values = rawValues.map(value => (value || '').replace(/\u00a0/g, ' ').replace(/,/g, '.').trim());

    const number = parseInt(values[0] || '0', 10);
    const name = cleanPlayerName(values[1] || '');
    const minutes = parseMinutes(values[4] || '');

    if (Number.isNaN(number) || !name || minutes === 0) continue;

    const toInt = (index: number) => {
      const parsed = parseInt(values[index] || '0', 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const toFloat = (index: number) => {
      const parsed = parseFloat(values[index] || '0');
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const defensiveRebounds = toInt(17);
    const offensiveRebounds = toInt(18);
    const totalRebounds = toInt(19) || defensiveRebounds + offensiveRebounds;

    players.push({
      number,
      name,
      minutes,
      points: toInt(3),
      closeShots: { made: toInt(5), attempted: toInt(6) },
      midRangeShots: { made: toInt(8), attempted: toInt(9) },
      threePointers: { made: toInt(11), attempted: toInt(12) },
      freeThrows: { made: toInt(14), attempted: toInt(15) },
      rebounds: {
        offensive: offensiveRebounds,
        defensive: defensiveRebounds,
        total: totalRebounds,
      },
      assists: toInt(24),
      steals: toInt(20),
      turnovers: toInt(21),
      blocks: toInt(25),
      fouls: toInt(22),
      valuation: toInt(27),
      advanced: {
        offensiveRating: toFloat(28),
        defensiveRating: toFloat(29),
        trueShootingPct: toFloat(30),
        effectiveFGPct: toFloat(31),
      },
    });
  }

  return players;
};

const scrapeAllPlayerTables = async (page: Page): Promise<[PlayerStats[], PlayerStats[]]> => {
  const tables = await collectStatTables(page);
  if (tables.length < 2) {
    console.warn('  ⚠️ Nem sikerült beolvasni a statisztika táblákat.');
    return [[], []];
  }

  const homePlayers = await scrapePlayerTable(tables[0]);
  const awayPlayers = await scrapePlayerTable(tables[1]);
  return [homePlayers, awayPlayers];
};

const scrapeGameDetails = async (page: Page, link: GameLink): Promise<ScrapedGame | null> => {
  try {
    console.log(`  📥 Letöltés: ${link.url}`);
    await page.goto(link.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const bodyText = (await page.textContent('body')) || '';
    const dateMatch = bodyText.match(/(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/);
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      : link.date;

    const { homeTeam, awayTeam } = await resolveTeamNames(page, link.homeTeam, link.awayTeam);
    const { homeScore, awayScore } = parseScore(link.score);
    if (homeScore === 0 && awayScore === 0) {
      console.warn('  ⚠️ 0-0 eredmény, import kihagyva');
      return null;
    }
    const [homePlayers, awayPlayers] = await scrapeAllPlayerTables(page);
    const round = typeof link.round === 'number' ? link.round : null;

    console.log(`  ✅ ${homeTeam} vs ${awayTeam} (${homeScore}-${awayScore}) — ${homePlayers.length + awayPlayers.length} játékos`);

    const teams: TeamGameImport[] = [
      {
        teamName: homeTeam,
        opponentName: awayTeam,
        homeAway: 'home',
        ourScore: homeScore,
        oppScore: awayScore,
        result: homeScore > awayScore ? 'win' : 'loss',
        round,
        players: homePlayers,
      },
      {
        teamName: awayTeam,
        opponentName: homeTeam,
        homeAway: 'away',
        ourScore: awayScore,
        oppScore: homeScore,
        result: awayScore > homeScore ? 'win' : 'loss',
        round,
        players: awayPlayers,
      },
    ];

    return { date, round, teams };
  } catch (error) {
    console.error('  ❌ Hiba a meccs részleteinek feldolgozásakor:', error);
    return null;
  }
};

const ensurePlayerRecord = async (player: PlayerStats, teamId: string, seasonId: string): Promise<string> => {
  const playerName = cleanPlayerName(player.name);
  const normalizedIncomingName = normalizeName(playerName);

  const { data: sameNumberPlayers, error: sameNumberError } = await supabase
    .from('players')
    .select('id, name, number')
    .eq('number', player.number)
    .eq('season_id', seasonId)
    .eq('team_id', teamId);

  if (sameNumberError) {
    throw new Error(`Játékos lekérdezési hiba (${playerName}): ${sameNumberError.message}`);
  }

  const exactByNumberAndName = (sameNumberPlayers || []).find(
    candidate => normalizeName(candidate.name) === normalizedIncomingName
  );
  if (exactByNumberAndName) {
    return exactByNumberAndName.id;
  }

  const { data: sameNamePlayers, error: sameNameError } = await supabase
    .from('players')
    .select('id, name, number')
    .eq('season_id', seasonId)
    .eq('team_id', teamId)
    .ilike('name', playerName);

  if (sameNameError) {
    throw new Error(`Játékos név szerinti lekérdezési hiba (${playerName}): ${sameNameError.message}`);
  }

  const exact = (sameNamePlayers || []).find(
    candidate => normalizeName(candidate.name) === normalizedIncomingName
  );
  if (exact) {
    return exact.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('players')
    .insert({
      name: playerName,
      number: player.number,
      position: 'G',
      season_id: seasonId,
      team_id: teamId,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(`Játékos létrehozási hiba (${playerName}): ${insertError?.message}`);
  }

  return inserted.id;
};

const syncPlayerStats = async (
  gameId: string,
  teamId: string,
  seasonId: string,
  players: PlayerStats[]
) => {
  const { error: deleteError } = await supabase.from('player_game_stats').delete().eq('game_id', gameId);

  if (deleteError) {
    throw new Error(`Player stat törlés hiba: ${deleteError.message}`);
  }

  for (const stats of players) {
    try {
      const playerId = await ensurePlayerRecord(stats, teamId, seasonId);
      const { error } = await supabase.from('player_game_stats').insert({
        game_id: gameId,
        player_id: playerId,
        minutes: stats.minutes,
        points: stats.points,
        close_made: stats.closeShots.made,
        close_attempted: stats.closeShots.attempted,
        mid_made: stats.midRangeShots.made,
        mid_attempted: stats.midRangeShots.attempted,
        three_made: stats.threePointers.made,
        three_attempted: stats.threePointers.attempted,
        free_throw_made: stats.freeThrows.made,
        free_throw_attempted: stats.freeThrows.attempted,
        offensive_rebounds: stats.rebounds.offensive,
        defensive_rebounds: stats.rebounds.defensive,
        total_rebounds: stats.rebounds.total,
        assists: stats.assists,
        steals: stats.steals,
        turnovers: stats.turnovers,
        blocks: stats.blocks,
        fouls_committed: stats.fouls,
        valuation: stats.valuation,
        offensive_rating: stats.advanced.offensiveRating,
        defensive_rating: stats.advanced.defensiveRating,
        true_shooting_percentage: stats.advanced.trueShootingPct,
        effective_field_goal_percentage: stats.advanced.effectiveFGPct,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (playerError) {
      console.error(`      ⚠️ ${stats.name} stat nem frissült:`, playerError);
    }
  }
};

const importGame = async (date: string, seasonId: string, teamGame: TeamGameImport) => {
  const team = await ensureTeam(teamGame.teamName);
  const opponent = await ensureTeam(teamGame.opponentName);

  const { data: existingGame, error: existingError } = await supabase
    .from('games')
    .select('id, home_away, our_score, opp_score, result, opponent, round')
    .eq('date', date)
    .eq('season_id', seasonId)
    .eq('our_team_id', team.id)
    .eq('opponent', opponent.name)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Meccs lekérdezési hiba: ${existingError.message}`);
  }

  if (existingGame) {
    const needsUpdate =
      existingGame.home_away !== teamGame.homeAway ||
      existingGame.our_score !== teamGame.ourScore ||
      existingGame.opp_score !== teamGame.oppScore ||
      existingGame.result !== teamGame.result ||
      existingGame.opponent !== opponent.name ||
      existingGame.round !== teamGame.round;

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('games')
        .update({
          home_away: teamGame.homeAway,
          our_score: teamGame.ourScore,
          opp_score: teamGame.oppScore,
          result: teamGame.result,
          opponent: opponent.name,
          round: teamGame.round,
        })
        .eq('id', existingGame.id);

      if (updateError) {
        throw new Error(`Meccs frissítési hiba: ${updateError.message}`);
      }

      console.log(`    🔁 ${team.name} meccs frissítve (hazai/vendég korrekció)`);
    } else {
      console.log(`    ↺ ${team.name} vs ${opponent.name} (${date}) változatlan`);
    }

    await syncPlayerStats(existingGame.id, team.id, seasonId, teamGame.players);
    return;
  }

  const { data: insertedGame, error: insertError } = await supabase
    .from('games')
    .insert({
      date,
      season_id: seasonId,
      our_team_id: team.id,
      opponent: opponent.name,
      home_away: teamGame.homeAway,
      our_score: teamGame.ourScore,
      opp_score: teamGame.oppScore,
      result: teamGame.result,
      round: teamGame.round,
    })
    .select('id')
    .single();

  if (insertError || !insertedGame) {
    throw new Error(`Meccs létrehozási hiba: ${insertError?.message}`);
  }

  console.log(`    ✅ ${team.name} meccs mentve (${teamGame.players.length} játékos)`);
  await syncPlayerStats(insertedGame.id, team.id, seasonId, teamGame.players);
};

const main = async () => {
  console.log('🚀 HUNBASKET teljes szezon import indítása');

  await refreshTeamCache();
  const seasonId = await resolveSeasonId();

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    const games = await getGameLinks(page);

    if (games.length === 0) {
      console.log('⚠️ Nincs feldolgozható meccs a megadott szűrővel.');
      return;
    }

    console.log(`📊 ${games.length} meccs feldolgozása...`);

    for (const [index, game] of games.entries()) {
      const roundLabel = typeof game.round === 'number' ? `${game.round}. forduló | ` : '';
      console.log(`\n[${index + 1}/${games.length}] ${roundLabel}${cleanTeamName(game.homeTeam)} vs ${cleanTeamName(game.awayTeam)} (${game.score})`);
      const scraped = await scrapeGameDetails(page, game);
      if (!scraped) continue;

      for (const teamGame of scraped.teams) {
        if (teamGame.players.length === 0) {
          console.warn(`    ⚠️ ${teamGame.teamName}: nincs játékos adat, import kihagyva`);
          continue;
        }
        await importGame(scraped.date, seasonId, teamGame);
      }

      await page.waitForTimeout(1500);
    }

    console.log('\n✅ KÉSZ! A szezon összes meccse feldolgozva.');
  } catch (error) {
    console.error('❌ Váratlan hiba futás közben:', error);
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('❌ Kritikus hiba:', error);
  process.exit(1);
});
