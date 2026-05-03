import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók!');
  process.exit(1);
}

const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function parseOptionalInt(value?: string) {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const HUNBASKET_LEAGUE_CODE = process.env.HUNBASKET_LEAGUE_CODE || 'hun';
const HUNBASKET_STANDINGS_URL =
  process.env.HUNBASKET_STANDINGS_URL ||
  `https://hunbasket.hu/tabella/ferfi/${HUNBASKET_SEASON_SLUG}/${HUNBASKET_LEAGUE_CODE}`;
const HUNBASKET_STANDINGS_MATCHDAY = parseOptionalInt(process.env.HUNBASKET_STANDINGS_MATCHDAY);
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;

type StandingRow = {
  position: number;
  team: string;
  matches: number;
  winPct: number;
  points: number;
  wins: number;
  losses: number;
  scored: number;
  conceded: number;
  streak: string;
  home: string;
  away: string;
  last5: string;
};

const cleanTeamName = (value: string) =>
  value
    .replace(/first teams logo|second teams logo|logo/gi, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseLooseInt = (value: string) => {
  const cleaned = value.replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseLooseFloat = (value: string) => {
  const cleaned = value.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
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
        `HUNBASKET_SEASON_ID (${data.name}) nem egyezik a HUNBASKET_SEASON_NAME értékkel (${HUNBASKET_SEASON_NAME}).`
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
    throw new Error(`Nem található \"${HUNBASKET_SEASON_NAME}\" szezon.`);
  }

  return data.id;
};

const scrapeStandings = async (page: Page): Promise<StandingRow[]> => {
  await page.goto(HUNBASKET_STANDINGS_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const rows = await page.$$eval('table tbody tr', tableRows => {
    return tableRows
      .map(row => Array.from(row.querySelectorAll('td')).map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim()))
      .filter(cells => cells.length >= 12);
  });

  const standings = rows
    .map(cells => {
      const position = parseLooseInt(cells[0] || '');
      if (position <= 0) return null;

      return {
        position,
        team: cleanTeamName(cells[1] || ''),
        matches: parseLooseInt(cells[2] || ''),
        winPct: parseLooseFloat(cells[3] || ''),
        points: parseLooseInt(cells[4] || ''),
        wins: parseLooseInt(cells[5] || ''),
        losses: parseLooseInt(cells[6] || ''),
        scored: parseLooseInt(cells[7] || ''),
        conceded: parseLooseInt(cells[8] || ''),
        streak: (cells[9] || '').trim(),
        home: (cells[10] || '').trim(),
        away: (cells[11] || '').trim(),
        last5: (cells[12] || '').trim(),
      } as StandingRow;
    })
    .filter((row): row is StandingRow => Boolean(row?.team));

  standings.sort((a, b) => a.position - b.position);
  return standings;
};

const resolveMatchday = (rows: StandingRow[]) => {
  if (HUNBASKET_STANDINGS_MATCHDAY && HUNBASKET_STANDINGS_MATCHDAY > 0) {
    return HUNBASKET_STANDINGS_MATCHDAY;
  }

  const maxMatches = rows.reduce((acc, row) => Math.max(acc, row.matches || 0), 0);
  return maxMatches > 0 ? maxMatches : 1;
};

const upsertStandings = async (seasonId: string, rows: StandingRow[]) => {
  const matchday = resolveMatchday(rows);
  const date = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from('standings')
    .upsert(
      {
        season_id: seasonId,
        matchday,
        date,
        data: rows,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'season_id,matchday' }
    );

  if (error) {
    throw new Error(`Standings mentési hiba: ${error.message}`);
  }

  return matchday;
};

const main = async () => {
  console.log(`📊 Hunbasket tabella import indítása: ${HUNBASKET_STANDINGS_URL}`);

  const seasonId = await resolveSeasonId();
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    const standings = await scrapeStandings(page);
    if (standings.length === 0) {
      console.warn(`⚠️ A tabella nem tartalmaz feldolgozható sorokat: ${HUNBASKET_STANDINGS_URL} – kihagyva.`);
      return;
    }

    const matchday = await upsertStandings(seasonId, standings);
    console.log(`✅ Tabella import kész: ${standings.length} csapat, forduló: ${matchday}`);
  } finally {
    await browser.close();
  }
};

main().catch(error => {
  console.error('❌ Tabella import hiba:', error);
  process.exit(1);
});
