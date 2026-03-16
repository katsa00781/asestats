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

const HUNBASKET_SEASON_SLUG = process.env.HUNBASKET_SEASON_SLUG || 'x2526';
const HUNBASKET_SEASON_NAME = process.env.HUNBASKET_SEASON_NAME || '2025/2026';
const HUNBASKET_SEASON_ID = process.env.HUNBASKET_SEASON_ID;
const HEADLESS = process.env.HUNBASKET_HEADLESS === 'false' ? false : true;
const STANDINGS_URL = process.env.HUNBASKET_STANDINGS_URL
  || `https://hunbasket.hu/tabella/ferfi/${HUNBASKET_SEASON_SLUG}/hun`;
const FALLBACK_STANDINGS_URL = 'https://hunbasket.hu/tabella/ferfi';

const TEAM_FILTER = (process.env.HUNBASKET_TEAM_FILTER || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const POSITION_LABELS: Record<string, string> = {
  '1': 'Irányító',
  '2': 'Dobóhátvéd',
  '3': 'Kiscsatár',
  '4': 'Erőcsatár',
  '5': 'Center',
};

type TeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
  is_primary?: boolean | null;
};

type PlayerRecord = {
  id: string;
  name: string;
  number: number;
  position?: string | null;
  birth_year?: number | null;
  height?: number | null;
  weight?: number | null;
  is_active?: boolean | null;
};

type TeamLink = {
  name: string;
  url: string;
};

type ScrapedRosterPlayer = {
  number: number;
  name: string;
  birthYear: number | null;
  position: string;
  heightCm: number | null;
  weightKg: number | null;
};

type SyncSummary = {
  inserted: number;
  updated: number;
  reactivated: number;
  deactivated: number;
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

const TEAM_FILTER_NORMALIZED = TEAM_FILTER.map(normalizeName).filter(Boolean);

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
        `HUNBASKET_SEASON_ID (${data.name}) nem egyezik a HUNBASKET_SEASON_NAME értékkel (${HUNBASKET_SEASON_NAME}). `
        + 'Frissítsd vagy töröld a HUNBASKET_SEASON_ID változót.'
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

const dismissCookieBanner = async (page: Page) => {
  try {
    const acceptButton = page.locator('button:has-text("Elfogadom")');
    if (await acceptButton.count()) {
      await acceptButton.first().click({ timeout: 2000 }).catch(() => undefined);
    }
  } catch (error) {
    console.warn('  ⚠️ Süti banner elfogadása nem sikerült:', error);
  }
};

const openStandingsPage = async (page: Page) => {
  const tryNavigate = async (url: string) => {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response && response.ok()) {
        return true;
      }
    } catch (error) {
      console.warn(`  ⚠️ Nem sikerült betölteni: ${url}`, error);
    }
    return false;
  };

  const primaryLoaded = await tryNavigate(STANDINGS_URL);
  if (!primaryLoaded) {
    await tryNavigate(FALLBACK_STANDINGS_URL);
  }

  await page.waitForTimeout(3000);
  await dismissCookieBanner(page);
};

const getTeamLinks = async (page: Page): Promise<TeamLink[]> => {
  await openStandingsPage(page);

  const teams = await page.$$eval('table tbody tr', rows => {
    const unique: Record<string, { name: string; url: string }> = {};

    rows.forEach(row => {
      const link = row.querySelector<HTMLAnchorElement>('a[href*="/csapat/"]');
      if (!link) return;
      const name = (link.textContent || '').replace(/\s+/g, ' ').trim();
      const url = link.href;
      if (!name || !url) return;
      const key = name.toLowerCase();
      if (!unique[key]) {
        unique[key] = { name, url };
      }
    });

    return Object.values(unique);
  });

  const sanitized = teams
    .map(team => ({
      name: cleanTeamName(team.name),
      url: team.url,
    }))
    .filter(team => matchesFilter(team.name));

  if (TEAM_FILTER_NORMALIZED.length > 0) {
    console.log(`📋 Csapatszűrő aktív (${TEAM_FILTER_NORMALIZED.length} elem)`);
  }

  console.log(`✅ ${sanitized.length} csapat a feldolgozási listán`);
  return sanitized;
};

type RawRosterRow = {
  number: string;
  name: string;
  birthYear: string;
  position: string;
  height: string;
  weight: string;
};

const scrapeRoster = async (page: Page, url: string): Promise<ScrapedRosterPlayer[]> => {
  console.log(`  🌐 Roster oldal megnyitása: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await dismissCookieBanner(page);

  const keywords = ['született', 'birth', 'cm', 'kg', 'magasság', 'súly', 'pozíció', 'position'];
  const tables = page.locator('table');
  const tableCount = await tables.count();
  let rawRows: RawRosterRow[] = [];
  let bestScore = 0;

  for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
    const table = tables.nth(tableIndex);
    const tableText = ((await table.textContent()) || '').toLowerCase();
    let headerScore = 0;
    keywords.forEach(keyword => {
      if (tableText.includes(keyword)) headerScore += 1;
    });

    let rows = table.locator('tbody tr');
    let rowCount = await rows.count();
    if (rowCount === 0) {
      rows = table.locator('tr');
      rowCount = await rows.count();
    }

    const entries: RawRosterRow[] = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const cells = rows.nth(rowIndex).locator('td');
      const cellCount = await cells.count();
      if (cellCount < 6) continue;

      const values = (await cells.allTextContents()).map(value => value.replace(/\s+/g, ' ').trim());
      entries.push({
        number: values[0] || '',
        name: values[1] || '',
        birthYear: values[2] || '',
        position: values[3] || '',
        height: values[4] || '',
        weight: values[5] || '',
      });
    }

    const validCount = entries.filter(entry => /\d/.test(entry.number) && Boolean(entry.name)).length;
    if (validCount === 0) continue;

    const score = headerScore * 10 + validCount;
    if (score > bestScore) {
      bestScore = score;
      rawRows = entries;
    }
  }

  const toInt = (value: string) => {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const formatPosition = (value: string) => {
    const normalized = value.replace(/[^0-9\-/]/g, '').trim();
    const digitTokens = normalized
      .split(/[-/]+/)
      .map(token => token.trim())
      .filter(Boolean);
    const rawTokens = digitTokens.length > 0 ? digitTokens : (value.match(/[1-5]/g) || []);
    const unique = Array.from(new Set(rawTokens));
    if (unique.length === 0) {
      return value.trim() || 'N/A';
    }
    const label = unique.map(token => POSITION_LABELS[token] || token).join('/');
    if (unique.length === 1 && POSITION_LABELS[unique[0]]) {
      return `${unique[0]} (${POSITION_LABELS[unique[0]]})`;
    }
    return `${unique.join('-')} (${label})`;
  };

  const roster = rawRows
    .map(row => {
      const number = toInt(row.number || '');
      const name = cleanPlayerName(row.name || '');
      if (!name || number === null) return null;

      const birthYear = toInt(row.birthYear || '');
      const heightCm = toInt(row.height || '');
      const weightKg = toInt(row.weight || '');
      const cleanedPosition = formatPosition(row.position || '');

      return {
        number,
        name,
        birthYear,
        position: cleanedPosition,
        heightCm,
        weightKg,
      } as ScrapedRosterPlayer;
    })
    .filter((player): player is ScrapedRosterPlayer => Boolean(player));

  console.log(`  📁 ${roster.length} játékos adat beolvasva`);
  return roster;
};

const buildPlayerKey = (name: string, number: number) => `${normalizeName(name)}::${number}`;

const syncRosterWithSupabase = async (
  team: TeamRecord,
  seasonId: string,
  roster: ScrapedRosterPlayer[]
): Promise<SyncSummary> => {
  const { data: existingPlayers, error } = await supabase
    .from('players')
    .select('id, name, number, position, birth_year, height, weight, is_active')
    .eq('team_id', team.id)
    .eq('season_id', seasonId);

  if (error) {
    throw new Error(`Játékos lista lekérdezési hiba (${team.name}): ${error.message}`);
  }

  const summary: SyncSummary = {
    inserted: 0,
    updated: 0,
    reactivated: 0,
    deactivated: 0,
  };

  const existingMap = new Map<string, PlayerRecord>();
  (existingPlayers || []).forEach(player => {
    existingMap.set(buildPlayerKey(player.name, player.number), player);
  });

  const processedIds = new Set<string>();

  for (const player of roster) {
    const key = buildPlayerKey(player.name, player.number);
    let match = existingMap.get(key);

    if (!match) {
      match = (existingPlayers || []).find(p => normalizeName(p.name) === normalizeName(player.name));
    }

    if (match) {
      processedIds.add(match.id);
      const updates: Record<string, unknown> = {};

      if (match.name !== player.name) updates.name = player.name;
      if (match.number !== player.number) updates.number = player.number;
      if ((match.position || 'N/A') !== player.position) updates.position = player.position;
      if ((match.birth_year ?? null) !== (player.birthYear ?? null)) updates.birth_year = player.birthYear;
      if ((match.height ?? null) !== (player.heightCm ?? null)) updates.height = player.heightCm;
      if ((match.weight ?? null) !== (player.weightKg ?? null)) updates.weight = player.weightKg;
      if (match.is_active === false) {
        updates.is_active = true;
        summary.reactivated += 1;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('players')
          .update(updates)
          .eq('id', match.id);

        if (updateError) {
          console.error(`    ❌ Hiba ${player.name} frissítésekor: ${updateError.message}`);
        } else {
          summary.updated += 1;
        }
      }

      continue;
    }

    const { error: insertError } = await supabase
      .from('players')
      .insert({
        name: player.name,
        number: player.number,
        position: player.position,
        birth_year: player.birthYear,
        height: player.heightCm,
        weight: player.weightKg,
        is_active: true,
        team_id: team.id,
        season_id: seasonId,
      });

    if (insertError) {
      console.error(`    ❌ Hiba ${player.name} felvitelekor: ${insertError.message}`);
    } else {
      summary.inserted += 1;
    }
  }

  const inactiveCandidates = (existingPlayers || [])
    .filter(player => !processedIds.has(player.id) && (player.is_active ?? true));

  if (inactiveCandidates.length > 0) {
    const ids = inactiveCandidates.map(player => player.id);
    const { error: deactivateError } = await supabase
      .from('players')
      .update({ is_active: false })
      .in('id', ids);

    if (deactivateError) {
      console.error(`    ❌ Hiba az inaktiváláskor: ${deactivateError.message}`);
    } else {
      summary.deactivated += inactiveCandidates.length;
    }
  }

  return summary;
};

const main = async () => {
  console.log('🚀 HUNBASKET keret frissítés indul');

  await refreshTeamCache();
  const seasonId = await resolveSeasonId();

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    const teamLinks = await getTeamLinks(page);
    if (teamLinks.length === 0) {
      console.log('⚠️ Nincs feldolgozható csapat. Ellenőrizd a szűrőt vagy az URL-t.');
      return;
    }

    for (const [index, teamLink] of teamLinks.entries()) {
      console.log(`\n[${index + 1}/${teamLinks.length}] ${teamLink.name}`);
      const roster = await scrapeRoster(page, teamLink.url);
      if (roster.length === 0) {
        console.warn('  ⚠️ Nincs olvasható játékos adat, csapat kihagyva.');
        continue;
      }

      const team = await ensureTeam(teamLink.name);
      const summary = await syncRosterWithSupabase(team, seasonId, roster);

      console.log(
        `  ✅ Eredmény: ${summary.inserted} új • ${summary.updated} frissített • ${summary.reactivated} reaktivált • ${summary.deactivated} inaktivált`
      );

      await page.waitForTimeout(1500);
    }

    console.log('\n✨ Kész! Az összes kiválasztott csapat kerete frissítve.');
  } catch (error) {
    console.error('❌ Váratlan hiba futás közben:', error);
  } finally {
    await page.close();
    await browser.close();
  }
};

main().catch(error => {
  console.error('❌ Kritikus hiba:', error);
  process.exit(1);
});
