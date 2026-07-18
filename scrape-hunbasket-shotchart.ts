import { chromium, type Page } from 'playwright';
import * as dotenv from 'dotenv';
import { cleanTeamName, findTeamByNameStrict, createScriptClient } from './scrape-utils';

dotenv.config({ path: '.env.local' });

const supabase = createScriptClient();

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const HUNBASKET_LEAGUE_CODE = process.env.HUNBASKET_LEAGUE_CODE || 'hun';
const HUNBASKET_SCHEDULE_URL =
  process.env.HUNBASKET_SCHEDULE_URL || `https://hunbasket.hu/menetrend-teljes/ferfi/${HUNBASKET_SEASON_SLUG}/${HUNBASKET_LEAGUE_CODE}`;
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;

const API_URL = 'https://hunbasket.hu/ajax/film.php';

type ScheduleGame = {
  round: number | null;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchUrl: string;
  gameCode: string;
};

type TeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
};

type ShotEvent = {
  playercode?: string;
  playercode2?: string;
  team_id?: string;
  side?: string;
  period?: string;
  x?: number;
  y?: number;
  event_order?: string;
  firstname?: string;
  lastname?: string;
  wbname?: string;
  is_successfull?: boolean;
};

let cachedTeams: TeamRecord[] = [];

const refreshTeamCache = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name')
    .order('name');

  if (error) {
    throw new Error(`Team cache load failed: ${error.message}`);
  }

  cachedTeams = data || [];
};

const findTeamInCache = (name: string) => findTeamByNameStrict(cachedTeams, name);

const ensureTeam = async (name: string): Promise<TeamRecord> => {
  const cleaned = cleanTeamName(name);
  const existing = findTeamInCache(cleaned);
  if (existing) return existing;

  const shortName = cleaned.split(' ')[0] || cleaned;
  const { data, error } = await supabase
    .from('teams')
    .insert({ name: cleaned, short_name: shortName, is_primary: false })
    .select('id, name, short_name')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create team ${cleaned}: ${error?.message}`);
  }

  cachedTeams.push(data);
  return data;
};

const resolveSeasonId = async (): Promise<string> => {
  if (HUNBASKET_SEASON_ID) {
    const { data, error } = await supabase
      .from('seasons')
      .select('id')
      .eq('id', HUNBASKET_SEASON_ID)
      .single();

    if (error || !data) {
      throw new Error(`Season not found for HUNBASKET_SEASON_ID=${HUNBASKET_SEASON_ID}`);
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', HUNBASKET_SEASON_NAME)
    .single();

  if (error || !data) {
    throw new Error(`Season not found: ${HUNBASKET_SEASON_NAME}`);
  }

  return data.id;
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

const scrapePlayedGames = async (page: Page): Promise<ScheduleGame[]> => {
  await page.goto(HUNBASKET_SCHEDULE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const rows = await page.$$eval('table tbody tr', tableRows => {
    return tableRows
      .map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return null;

        const roundText = (cells[0]?.textContent || '').trim();
        const homeTeam = (cells[1]?.textContent || '').trim();
        const scoreText = (cells[2]?.textContent || '').trim();
        const awayTeam = (cells[3]?.textContent || '').trim();
        const dateText = (cells[4]?.textContent || '').trim();
        const matchAnchor = row.querySelector('a[href*="/merkozes/"]') as HTMLAnchorElement | null;

        if (!matchAnchor) return null;

        const scoreMatch = scoreText.match(/(\d+)\s*[–-]\s*(\d+)/);
        if (!scoreMatch) return null;

        const homeScore = parseInt(scoreMatch[1], 10);
        const awayScore = parseInt(scoreMatch[2], 10);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || (homeScore === 0 && awayScore === 0)) {
          return null;
        }

        const dateMatch = dateText.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
        if (!dateMatch) return null;

        const gameCodeMatch = matchAnchor.href.match(/\/merkozes\/[^/]+\/[^/]+\/(hun_\d+)/i);
        if (!gameCodeMatch) return null;

        const roundMatch = roundText.match(/\d+/);

        return {
          round: roundMatch ? parseInt(roundMatch[0], 10) : null,
          date: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`,
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          matchUrl: matchAnchor.href,
          gameCode: gameCodeMatch[1],
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  });

  return rows.map(row => ({
    ...row,
    homeTeam: cleanTeamName(row.homeTeam),
    awayTeam: cleanTeamName(row.awayTeam),
  }));
};

const fetchShotchart = async (gameCode: string): Promise<ShotEvent[]> => {
  const body = new URLSearchParams({
    gamecode: gameCode,
    lea: HUNBASKET_LEAGUE_CODE,
    year: HUNBASKET_SEASON_SLUG,
    f: 'getShootchart',
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Invalid shotchart payload (not an array).');
  }

  return data as ShotEvent[];
};

const upsertRawGame = async (seasonId: string, game: ScheduleGame, shotchartData: ShotEvent[]) => {
  const homeTeam = await ensureTeam(game.homeTeam);
  const awayTeam = await ensureTeam(game.awayTeam);

  const payload = {
    season_id: seasonId,
    game_code: game.gameCode,
    league_code: HUNBASKET_LEAGUE_CODE,
    season_slug: HUNBASKET_SEASON_SLUG,
    match_url: game.matchUrl,
    game_date: game.date,
    round: game.round,
    home_team_id: homeTeam.id,
    away_team_id: awayTeam.id,
    home_team: game.homeTeam,
    away_team: game.awayTeam,
    home_score: game.homeScore,
    away_score: game.awayScore,
    shotchart_data: shotchartData,
    event_count: shotchartData.length,
    imported_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('hunbasket_shotchart_raw')
    .upsert(payload, { onConflict: 'season_id,game_code' });

  if (error) {
    throw new Error(error.message);
  }
};

const main = async () => {
  const seasonId = await resolveSeasonId();
  await refreshTeamCache();

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    console.log(`Fetching played games from: ${HUNBASKET_SCHEDULE_URL}`);
    const games = await scrapePlayedGames(page);
    console.log(`Played games found: ${games.length}`);

    if (games.length === 0) {
      console.log('No played games found to import.');
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    let totalEvents = 0;

    for (const [index, game] of games.entries()) {
      const roundLabel = typeof game.round === 'number' ? `${game.round}. fordulo` : '-';
      console.log(`[${index + 1}/${games.length}] ${roundLabel} | ${game.homeTeam} vs ${game.awayTeam} | ${game.gameCode}`);

      try {
        const shotchartData = await fetchShotchart(game.gameCode);
        await upsertRawGame(seasonId, game, shotchartData);
        successCount += 1;
        totalEvents += shotchartData.length;
        console.log(`  OK - events: ${shotchartData.length}`);
      } catch (error) {
        failedCount += 1;
        console.error(`  FAIL - ${(error as Error).message}`);
      }

      await page.waitForTimeout(350);
    }

    console.log('Shotchart raw import completed.');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Total events imported: ${totalEvents}`);
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('Shotchart raw import failed:', error);
  process.exit(1);
});
