import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import { cleanTeamName, findTeamByNameFuzzy, createScriptClient } from './scrape-utils';

dotenv.config({ path: '.env.local' });

const supabase = createScriptClient();

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const HUNBASKET_SCHEDULE_URL =
  process.env.HUNBASKET_SCHEDULE_URL || `https://hunbasket.hu/menetrend-teljes/ferfi/${HUNBASKET_SEASON_SLUG}/hun`;
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;

type TeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
};

type ScheduleRow = {
  round: number | null;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'played';
  sourceUrl: string;
};

let cachedTeams: TeamRecord[] = [];

const refreshTeamCache = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name')
    .order('name');

  if (error) throw new Error(`Team cache load failed: ${error.message}`);
  cachedTeams = data || [];
};

// A box-score importtal azonos fuzzy matching: a szponzornév-drift
// (pl. "MVM-OSE Lions" -> "OSE Lions") ne termeljen duplikált teams sort.
const findTeamInCache = (name: string) => findTeamByNameFuzzy(cachedTeams, name);

// Névdrift-védelem – ugyanaz a szabály, mint a scrape-hunbasket.ts box-score
// importban: alapból NEM hozunk létre új csapatot, mert a scrapelt névváltozatok
// korábban duplikált teams sorokat termeltek.
// Valóban új csapathoz: HUNBASKET_ALLOW_NEW_TEAMS=1 környezeti változó.
const ALLOW_NEW_TEAMS = process.env.HUNBASKET_ALLOW_NEW_TEAMS === '1';

const createTeam = async (cleaned: string): Promise<TeamRecord> => {
  const shortName = cleaned.split(' ')[0] || cleaned;
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: cleaned, short_name: shortName, is_primary: false })
    .select('id, name, short_name')
    .single();

  if (error || !data) {
    const message = error?.message || '';
    const isShortNameConflict = message.includes('teams_short_name_key') || message.includes('duplicate key value');

    // A short_name UNIQUE – a névből képzett rövidítés ütközhet egy meglévő
    // csapatéval (pl. "OSE Lions" -> "OSE", ami már a "MVM-OSE Lions"-é).
    if (isShortNameConflict) {
      await refreshTeamCache();
      const recovered = findTeamInCache(cleaned);
      if (recovered) return recovered;

      const fallback = await supabase
        .from('teams')
        .insert({ name: cleaned, short_name: null, is_primary: false })
        .select('id, name, short_name')
        .single();

      if (!fallback.error && fallback.data) {
        cachedTeams.push(fallback.data);
        console.log(`  Új csapat felvéve (short_name nélkül): ${fallback.data.name}`);
        return fallback.data;
      }
    }

    throw new Error(`Csapat létrehozási hiba (${cleaned}): ${error?.message}`);
  }

  cachedTeams.push(data);
  console.log(`  Új csapat felvéve: ${data.name}`);
  return data;
};

/**
 * Előellenőrzés: minden csapatnevet feloldunk MIELŐTT bármit írnánk.
 * Így egyetlen ismeretlen név nem az import közepén robban, és egyszerre
 * jelenti az összes problémás nevet, nem csak az elsőt.
 */
const resolveTeams = async (fixtures: ScheduleRow[]): Promise<Map<string, TeamRecord>> => {
  const names = [...new Set(fixtures.flatMap(item => [item.homeTeam, item.awayTeam]))].sort();
  const resolved = new Map<string, TeamRecord>();
  const unknown: string[] = [];

  for (const name of names) {
    const cleaned = cleanTeamName(name);
    const existing = findTeamInCache(cleaned);

    if (existing) {
      if (existing.name !== cleaned) {
        console.log(`  Névdrift feloldva: "${cleaned}" -> "${existing.name}"`);
      }
      resolved.set(name, existing);
      continue;
    }

    if (!ALLOW_NEW_TEAMS) {
      unknown.push(cleaned);
      continue;
    }

    resolved.set(name, await createTeam(cleaned));
  }

  if (unknown.length > 0) {
    const knownNames = cachedTeams.map(team => team.name).join(', ');
    throw new Error(
      `Ismeretlen csapatnév a menetrendben (${unknown.length} db): ${unknown.map(item => `"${item}"`).join(', ')}. ` +
        'Névdrift-védelem miatt nem hozok létre új csapatot. Ha tényleg új csapatok, futtasd ' +
        `HUNBASKET_ALLOW_NEW_TEAMS=1 mellett. Ha csak névváltozás, előbb írd át a teams sort. Ismert csapatok: ${knownNames}`
    );
  }

  return resolved;
};

type SeasonRecord = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

const SEASON_FIELDS = 'id, name, start_date, end_date';

const resolveSeason = async (): Promise<SeasonRecord> => {
  if (HUNBASKET_SEASON_ID) {
    const { data, error } = await supabase
      .from('seasons')
      .select(SEASON_FIELDS)
      .eq('id', HUNBASKET_SEASON_ID)
      .single();
    if (error || !data) throw new Error(`Season not found for HUNBASKET_SEASON_ID=${HUNBASKET_SEASON_ID}`);
    return data as SeasonRecord;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select(SEASON_FIELDS)
    .eq('name', HUNBASKET_SEASON_NAME)
    .single();

  if (error || !data) throw new Error(`Season not found: ${HUNBASKET_SEASON_NAME}`);
  return data as SeasonRecord;
};

/**
 * Szezon-illeszkedés ellenőrzés. A menetrend URL slugja (x2526) és a
 * kiválasztott szezon egymástól függetlenül állítható – ha elcsúsznak,
 * egy másik évad teljes menetrendje kerül be rossz season_id alá.
 * Ez korábban ténylegesen megtörtént, ezért írunk elé kaput.
 */
const assertFixturesMatchSeason = (season: SeasonRecord, fixtures: ScheduleRow[]) => {
  if (fixtures.length === 0) return;

  if (!season.start_date || !season.end_date) {
    console.warn(`FIGYELEM: a(z) ${season.name} szezonnak nincs start_date/end_date értéke – az illeszkedés nem ellenőrizhető.`);
    return;
  }

  const outside = fixtures.filter(item => item.date < season.start_date! || item.date > season.end_date!);
  if (outside.length === 0) return;

  const dates = fixtures.map(item => item.date).sort();
  const ratio = outside.length / fixtures.length;
  const range = `${dates[0]} – ${dates[dates.length - 1]}`;
  const seasonRange = `${season.start_date} – ${season.end_date}`;

  // Néhány kilógó meccs lehet valós (elhalasztott mérkőzés) – csak jelezzük.
  if (ratio <= 0.1) {
    console.warn(
      `FIGYELEM: ${outside.length} mérkőzés dátuma a(z) ${season.name} szezon határain kívül esik (${seasonRange}): ` +
        outside.map(item => `${item.date} ${item.homeTeam}–${item.awayTeam}`).join(', ')
    );
    return;
  }

  throw new Error(
    `A menetrend nem illeszkedik a kiválasztott szezonhoz: a(z) ${fixtures.length} mérkőzésből ${outside.length} ` +
      `a(z) ${season.name} szezon határain kívül esik. Menetrend dátumtartomány: ${range}, szezon: ${seasonRange}. ` +
      `Valószínűleg rossz a slug vagy az URL (${HUNBASKET_SCHEDULE_URL}) a kiválasztott szezonhoz. Nem írok adatot.`
  );
};

const dismissCookieBanner = async (page: Page) => {
  try {
    const acceptButton = page.locator('button:has-text("Elfogadom")');
    if (await acceptButton.count()) {
      await acceptButton.first().click({ timeout: 2000 }).catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const parseScore = (score: string) => {
  const match = score.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) return { homeScore: null, awayScore: null, status: 'scheduled' as const };
  const homeScore = parseInt(match[1], 10);
  const awayScore = parseInt(match[2], 10);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return { homeScore: null, awayScore: null, status: 'scheduled' as const };
  }
  if (homeScore === 0 && awayScore === 0) {
    return { homeScore: null, awayScore: null, status: 'scheduled' as const };
  }
  return { homeScore, awayScore, status: 'played' as const };
};

const scrapeSchedule = async (page: Page): Promise<ScheduleRow[]> => {
  await page.goto(HUNBASKET_SCHEDULE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const rows = await page.$$eval('table tbody tr', tableRows => {
    return tableRows.map(row => {
      const cells = row.querySelectorAll('td');
      const roundText = (cells[0]?.textContent || '').trim();
      const homeTeam = (cells[1]?.textContent || '').trim();
      const score = (cells[2]?.textContent || '').trim();
      const awayTeam = (cells[3]?.textContent || '').trim();
      const dateText = (cells[4]?.textContent || '').trim();
      const roundMatch = roundText.match(/\d+/);
      const dateMatch = dateText.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
      const gameDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : '';

      return {
        round: roundMatch ? parseInt(roundMatch[0], 10) : null,
        homeTeam,
        awayTeam,
        score,
        gameDate,
      };
    });
  });

  return rows
    .filter(item => item.homeTeam && item.awayTeam && item.gameDate)
    .map(item => {
      const parsed = parseScore(item.score);
      return {
        round: item.round,
        date: item.gameDate,
        homeTeam: cleanTeamName(item.homeTeam),
        awayTeam: cleanTeamName(item.awayTeam),
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
        status: parsed.status,
        sourceUrl: HUNBASKET_SCHEDULE_URL,
      };
    });
};

const upsertFixtures = async (seasonId: string, fixtures: ScheduleRow[], teams: Map<string, TeamRecord>) => {
  let upserted = 0;
  let failed = 0;
  for (const fixture of fixtures) {
    const homeTeam = teams.get(fixture.homeTeam);
    const awayTeam = teams.get(fixture.awayTeam);
    if (!homeTeam || !awayTeam) {
      console.error(`Feloldatlan csapat: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.date})`);
      failed += 1;
      continue;
    }

    const payload = {
      season_id: seasonId,
      round: fixture.round,
      game_date: fixture.date,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      home_score: fixture.homeScore,
      away_score: fixture.awayScore,
      status: fixture.status,
      source_url: fixture.sourceUrl,
      imported_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('league_fixtures')
      .upsert(payload, { onConflict: 'season_id,game_date,home_team_id,away_team_id' });

    if (error) {
      console.error(`Failed fixture upsert: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.date})`, error.message);
      failed += 1;
      continue;
    }

    upserted += 1;
  }

  return { upserted, failed };
};

const main = async () => {
  const season = await resolveSeason();
  await refreshTeamCache();

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    console.log(`Fetching schedule: ${HUNBASKET_SCHEDULE_URL}`);
    console.log(`Target season: ${season.name} (${season.start_date} – ${season.end_date})`);
    const fixtures = await scrapeSchedule(page);
    console.log(`Parsed fixtures: ${fixtures.length}`);

    // Üres eredmény mindig hiba: rossz URL / megváltozott tábla-struktúra
    // esetén korábban "sikeres" importként futott le 0 meccsel.
    if (fixtures.length === 0) {
      throw new Error(
        `A menetrend oldalról egyetlen mérkőzés sem olvasható ki (${HUNBASKET_SCHEDULE_URL}). ` +
          'Ellenőrizd a slugot / URL-t, illetve hogy nem változott-e az oldal tábla-szerkezete.'
      );
    }

    assertFixturesMatchSeason(season, fixtures);

    const teams = await resolveTeams(fixtures);
    const { upserted, failed } = await upsertFixtures(season.id, fixtures, teams);
    const played = fixtures.filter(item => item.status === 'played').length;
    const scheduled = fixtures.filter(item => item.status === 'scheduled').length;

    console.log(`Upserted: ${upserted}`);
    if (failed > 0) console.log(`Failed: ${failed}`);
    console.log(`Played: ${played}`);
    console.log(`Scheduled: ${scheduled}`);
    console.log('Fixture import completed.');
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('Fixture import failed:', error);
  process.exit(1);
});
