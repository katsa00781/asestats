import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const HUNBASKET_SCHEDULE_URL =
  process.env.HUNBASKET_SCHEDULE_URL || `https://hunbasket.hu/menetrend-teljes/ferfi/${HUNBASKET_SEASON_SLUG}/hun`;
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
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

const findTeamInCache = (name: string) => {
  const normalizedTarget = normalizeName(name);
  if (!normalizedTarget) return undefined;

  return (
    cachedTeams.find(team => normalizeName(team.name) === normalizedTarget)
    || cachedTeams.find(team => team.short_name && normalizeName(team.short_name) === normalizedTarget)
    || cachedTeams.find(team => {
      const teamAbbr = buildAbbreviation(normalizeName(team.name));
      const targetAbbr = buildAbbreviation(normalizedTarget);
      return Boolean(teamAbbr) && teamAbbr === targetAbbr;
    })
  );
};

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

  if (error || !data) throw new Error(`Failed to create team ${cleaned}: ${error?.message}`);
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
    if (error || !data) throw new Error(`Season not found for HUNBASKET_SEASON_ID=${HUNBASKET_SEASON_ID}`);
    return data.id;
  }

  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', HUNBASKET_SEASON_NAME)
    .single();

  if (error || !data) throw new Error(`Season not found: ${HUNBASKET_SEASON_NAME}`);
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

const upsertFixtures = async (seasonId: string, fixtures: ScheduleRow[]) => {
  let upserted = 0;
  for (const fixture of fixtures) {
    const homeTeam = await ensureTeam(fixture.homeTeam);
    const awayTeam = await ensureTeam(fixture.awayTeam);

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
      continue;
    }

    upserted += 1;
  }

  return upserted;
};

const main = async () => {
  const seasonId = await resolveSeasonId();
  await refreshTeamCache();

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    console.log(`Fetching schedule: ${HUNBASKET_SCHEDULE_URL}`);
    const fixtures = await scrapeSchedule(page);
    console.log(`Parsed fixtures: ${fixtures.length}`);

    const upserted = await upsertFixtures(seasonId, fixtures);
    const played = fixtures.filter(item => item.status === 'played').length;
    const scheduled = fixtures.filter(item => item.status === 'scheduled').length;

    console.log(`Upserted: ${upserted}`);
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
