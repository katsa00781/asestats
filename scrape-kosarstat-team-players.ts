// Bajnokság-szintű játékosmozgás – kosarstat.hu csapat-archívum import.
//
// Két fázisban dolgozik:
//   1) kosarstat.hu/teams/ bejárása -> kosarstat csapat-ID feloldása a
//      meglévő `teams` sorokra (fuzzy match), eredmény: kosarstat_team_map.
//   2) Csapatonként a kosarstat.hu/teams/team/team_players/?team=<ID> oldal
//      beolvasása: minden valaha ott szerepelt játékos, hazai/légiós/
//      honosított státusszal és első-utolsó szezon (stint) tartománnyal.
//      A stint a nyomon követett szezonablakra vágva szezononkénti sorokra
//      bomlik: league_players + league_player_team_seasons upsert.
//
// A kosarstat.hu böngésző-szerű renderelést vár (raw HTTP kérésre 403-at ad),
// ezért Playwright kell hozzá, mint a scrape-kosarstat-playbyplay.ts-hez.

import { chromium, type Page } from 'playwright';
import { findTeamByNameFuzzy, cleanTeamName, createScriptClient, formatSupabaseError } from './scrape-utils';

const KOSARSTAT_BASE = 'https://kosarstat.hu';
const KOSARSTAT_HEADLESS = process.env.KOSARSTAT_HEADLESS === 'false' ? false : true;
const KOSARSTAT_MOVEMENT_SEASON_COUNT = parseInt(process.env.KOSARSTAT_MOVEMENT_SEASON_COUNT || '4', 10);
const TEAM_FILTER = (process.env.KOSARSTAT_TEAM_FILTER || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const supabase = createScriptClient();

type TeamRecord = {
  id: string;
  name: string;
  short_name?: string | null;
  is_primary?: boolean | null;
};

type SeasonRecord = {
  id: string;
  name: string;
  start_date: string;
};

type KosarstatTeamMapRow = {
  team_id: string;
  kosarstat_team_id: string;
  kosarstat_team_name: string;
};

type TeamPlayersRow = {
  name: string;
  profileUrl: string | null;
  kosarstatPlayerId: string | null;
  position: string | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  status: 'hazai' | 'legios' | 'honositott' | null;
  firstSeasonLabel: string;
  lastSeasonLabel: string;
};

// --- Segédfüggvények ------------------------------------------------------

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

const extractPlayerIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url, KOSARSTAT_BASE);
    return parsed.searchParams.get('player');
  } catch {
    return null;
  }
};

const extractTeamIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url, KOSARSTAT_BASE);
    return parsed.searchParams.get('team');
  } catch {
    return null;
  }
};

/** "2023-24", "2023-2024", "2023/2024" stb. -> kezdő év (2023). */
const extractStartYear = (label: string): number | null => {
  const match = label.match(/(\d{4})/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

const buildSeasonYearIndex = (seasons: SeasonRecord[]): Map<number, SeasonRecord> => {
  const index = new Map<number, SeasonRecord>();
  seasons.forEach(season => {
    const year = new Date(season.start_date).getFullYear();
    if (!Number.isNaN(year)) index.set(year, season);
  });
  return index;
};

const parsePositiveInt = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

const parseStatus = (value: string): 'hazai' | 'legios' | 'honositott' | null => {
  const normalized = value.toLowerCase();
  if (normalized.includes('honosít')) return 'honositott';
  if (normalized.includes('légiós') || normalized.includes('legios')) return 'legios';
  if (normalized.includes('hazai')) return 'hazai';
  return null;
};

// --- Fázis 1: csapat-ID feloldás -------------------------------------------

const resolveTeamMap = async (page: Page, trackedTeams: TeamRecord[]): Promise<KosarstatTeamMapRow[]> => {
  console.log('🔎 kosarstat.hu/teams/ bejárása a csapat-ID-k feloldásához...');
  await page.goto(`${KOSARSTAT_BASE}/teams/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);

  const rawTeams = await page.$$eval('a[href*="/teams/team/"]', anchors => {
    const unique: Record<string, { name: string; url: string }> = {};
    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href') || '';
      const name = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      if (!href || !name) return;
      const key = href;
      if (!unique[key]) unique[key] = { name, url: href };
    });
    return Object.values(unique);
  });

  const kosarstatTeams = rawTeams
    .map(team => ({
      name: cleanTeamName(team.name),
      teamId: extractTeamIdFromUrl(team.url),
    }))
    .filter((team): team is { name: string; teamId: string } => Boolean(team.teamId));

  console.log(`  📁 ${kosarstatTeams.length} kosarstat csapat-link találva`);

  const rows: KosarstatTeamMapRow[] = [];
  for (const team of trackedTeams) {
    const match = findTeamByNameFuzzy(kosarstatTeams.map(kt => ({ id: kt.teamId, name: kt.name })), team.name);
    if (!match) {
      console.warn(`  ⚠️ Nincs kosarstat párosítás: "${team.name}" – kihagyva (kézzel javítható a kosarstat_team_map-ben)`);
      continue;
    }
    rows.push({ team_id: team.id, kosarstat_team_id: match.id, kosarstat_team_name: match.name });
    console.log(`  ✅ ${team.name} -> kosarstat team=${match.id} (${match.name})`);
  }

  return rows;
};

const upsertTeamMap = async (rows: KosarstatTeamMapRow[]) => {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('kosarstat_team_map')
    .upsert(
      rows.map(row => ({
        team_id: row.team_id,
        kosarstat_team_id: row.kosarstat_team_id,
        kosarstat_team_name: row.kosarstat_team_name,
        matched_at: new Date().toISOString(),
      })),
      { onConflict: 'team_id' }
    );

  if (error) {
    throw new Error(`kosarstat_team_map upsert hiba: ${formatSupabaseError(error)}`);
  }
};

// --- Fázis 2: csapatonkénti roster-archívum ---------------------------------

// Élő DOM-on ellenőrzött oszlopfejlécek (2026-09-21, team=102 / Atomerőmű SE):
// "Játékos","Poszt","Szül.","Mag.","Töm.","Státusz","Első szezon","Utolsó szezon", ...
// Header-név alapján keressük az indexeket (nem fix pozíció), hogy egy
// esetleges oszlop-sorrend eltérés más csapatnál ne törje el a parse-t.
const COLUMN_LABELS = {
  position: 'poszt',
  birthYear: 'szül',
  height: 'mag',
  weight: 'töm',
  status: 'státusz',
  firstSeason: 'első szezon',
  lastSeason: 'utolsó szezon',
} as const;

const findColumnIndex = (headers: string[], label: string): number =>
  headers.findIndex(header => header.toLowerCase().trim().startsWith(label));

const scrapeTeamPlayers = async (page: Page, kosarstatTeamId: string): Promise<TeamPlayersRow[]> => {
  const url = `${KOSARSTAT_BASE}/teams/team/team_players/?team=${kosarstatTeamId}`;
  console.log(`  🌐 Roster-archívum megnyitása: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);

  // A "JÁTÉKOS STATISZTIKÁK" tábla a "Első szezon" + "Utolsó szezon" fejléc-
  // párról azonosítható egyértelműen (élő DOM-on ellenőrizve, ld. header
  // komment fent) – ez megbízhatóbb, mint kulcsszó-pontozás.
  const tables = page.locator('table');
  const tableCount = await tables.count();
  let targetTableIndex = -1;
  let headers: string[] = [];

  for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
    const table = tables.nth(tableIndex);
    const headerCells = await table.locator('thead th, thead td').allTextContents();
    const normalizedHeaders = headerCells.map(h => h.replace(/\s+/g, ' ').trim());
    if (
      findColumnIndex(normalizedHeaders, COLUMN_LABELS.firstSeason) !== -1 &&
      findColumnIndex(normalizedHeaders, COLUMN_LABELS.lastSeason) !== -1
    ) {
      targetTableIndex = tableIndex;
      headers = normalizedHeaders;
      break;
    }
  }

  if (targetTableIndex === -1) {
    console.warn('  ⚠️ Nem található "Első szezon"/"Utolsó szezon" fejlécű táblázat ezen az oldalon.');
    return [];
  }

  const colIndex = {
    position: findColumnIndex(headers, COLUMN_LABELS.position),
    birthYear: findColumnIndex(headers, COLUMN_LABELS.birthYear),
    height: findColumnIndex(headers, COLUMN_LABELS.height),
    weight: findColumnIndex(headers, COLUMN_LABELS.weight),
    status: findColumnIndex(headers, COLUMN_LABELS.status),
    firstSeason: findColumnIndex(headers, COLUMN_LABELS.firstSeason),
    lastSeason: findColumnIndex(headers, COLUMN_LABELS.lastSeason),
  };

  const table = tables.nth(targetTableIndex);
  const rowLocator = table.locator('tbody tr');
  const rowCount = await rowLocator.count();
  const results: TeamPlayersRow[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rowLocator.nth(rowIndex);
    const cells = row.locator('td');
    const cellCount = await cells.count();
    if (cellCount <= colIndex.lastSeason) continue;

    const values = (await cells.allTextContents()).map(value => value.replace(/\s+/g, ' ').trim());

    const link = row.locator('a[href*="/players/player/"]').first();
    const linkCount = await link.count();
    if (linkCount === 0) continue;
    const name = ((await link.textContent()) || '').replace(/\s+/g, ' ').trim();
    const href = (await link.getAttribute('href')) || '';
    const profileUrl = href ? new URL(href, KOSARSTAT_BASE).toString() : null;
    const kosarstatPlayerId = href ? extractPlayerIdFromUrl(href) : null;
    if (!name || !kosarstatPlayerId) continue;

    const firstSeasonLabel = values[colIndex.firstSeason] || '';
    const lastSeasonLabel = values[colIndex.lastSeason] || firstSeasonLabel;
    if (!firstSeasonLabel) continue;

    results.push({
      name,
      profileUrl,
      kosarstatPlayerId,
      position: colIndex.position !== -1 ? (values[colIndex.position] || null) : null,
      birthYear: colIndex.birthYear !== -1 ? parsePositiveInt(values[colIndex.birthYear]) : null,
      heightCm: colIndex.height !== -1 ? parsePositiveInt(values[colIndex.height]) : null,
      weightKg: colIndex.weight !== -1 ? parsePositiveInt(values[colIndex.weight]) : null,
      status: colIndex.status !== -1 ? parseStatus(values[colIndex.status] || '') : null,
      firstSeasonLabel,
      lastSeasonLabel,
    });
  }

  console.log(`  📁 ${results.length} játékos-stint beolvasva`);
  return results;
};

// --- Stint -> szezononkénti sorok, ablakra vágva ----------------------------

const expandStintToSeasons = (
  row: TeamPlayersRow,
  seasonYearIndex: Map<number, SeasonRecord>,
  trackedStartYears: number[]
): { seasonId: string | null; label: string }[] => {
  const firstYear = extractStartYear(row.firstSeasonLabel);
  const lastYear = extractStartYear(row.lastSeasonLabel);
  if (firstYear === null || lastYear === null) return [];

  const out: { seasonId: string | null; label: string }[] = [];
  for (const year of trackedStartYears) {
    if (year < firstYear || year > lastYear) continue;
    const season = seasonYearIndex.get(year);
    out.push({ seasonId: season ? season.id : null, label: `${year}-${String((year + 1) % 100).padStart(2, '0')}` });
  }
  return out;
};

// --- Upsert -----------------------------------------------------------------

const upsertLeaguePlayers = async (rows: TeamPlayersRow[]) => {
  const byId = new Map<string, TeamPlayersRow>();
  rows.forEach(row => {
    if (row.kosarstatPlayerId) byId.set(row.kosarstatPlayerId, row);
  });
  if (byId.size === 0) return;

  const { error } = await supabase
    .from('league_players')
    .upsert(
      Array.from(byId.values()).map(row => ({
        kosarstat_player_id: row.kosarstatPlayerId,
        display_name: row.name,
        position: row.position,
        birth_year: row.birthYear,
        height_cm: row.heightCm,
        weight_kg: row.weightKg,
        latest_status: row.status,
        profile_url: row.profileUrl,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'kosarstat_player_id' }
    );

  if (error) {
    throw new Error(`league_players upsert hiba: ${formatSupabaseError(error)}`);
  }
};

const upsertTeamSeasons = async (
  teamId: string,
  rows: TeamPlayersRow[],
  seasonYearIndex: Map<number, SeasonRecord>,
  trackedStartYears: number[]
): Promise<{ rowsUpserted: number; unmatchedSeasonLabels: Set<string> }> => {
  const unmatchedSeasonLabels = new Set<string>();
  const records: {
    kosarstat_player_id: string;
    team_id: string;
    season_id: string | null;
    kosarstat_season_label: string;
    status_at_time: string | null;
  }[] = [];

  for (const row of rows) {
    if (!row.kosarstatPlayerId) continue;
    const seasons = expandStintToSeasons(row, seasonYearIndex, trackedStartYears);
    if (seasons.length === 0) {
      unmatchedSeasonLabels.add(`${row.firstSeasonLabel}–${row.lastSeasonLabel}`);
      continue;
    }
    seasons.forEach(({ seasonId, label }) => {
      if (!seasonId) unmatchedSeasonLabels.add(label);
      records.push({
        kosarstat_player_id: row.kosarstatPlayerId as string,
        team_id: teamId,
        season_id: seasonId,
        kosarstat_season_label: label,
        status_at_time: row.status,
      });
    });
  }

  if (records.length === 0) return { rowsUpserted: 0, unmatchedSeasonLabels };

  const { error } = await supabase
    .from('league_player_team_seasons')
    .upsert(records, { onConflict: 'kosarstat_player_id,team_id,kosarstat_season_label' });

  if (error) {
    throw new Error(`league_player_team_seasons upsert hiba: ${formatSupabaseError(error)}`);
  }

  return { rowsUpserted: records.length, unmatchedSeasonLabels };
};

// --- Fő futás -----------------------------------------------------------------

const main = async () => {
  console.log('🚀 Kosarstat csapat-archívum (játékosmozgás) import indul');

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, short_name, is_primary')
    .order('name');
  if (teamsError || !teams) {
    throw new Error(`Csapatok betöltési hiba: ${formatSupabaseError(teamsError)}`);
  }

  const trackedTeams = teams.filter(team =>
    TEAM_FILTER.length === 0 || TEAM_FILTER.some(filter => team.name.toLowerCase().includes(filter.toLowerCase()))
  );

  const { data: seasons, error: seasonsError } = await supabase
    .from('seasons')
    .select('id, name, start_date')
    .order('start_date', { ascending: false })
    .limit(KOSARSTAT_MOVEMENT_SEASON_COUNT);
  if (seasonsError || !seasons) {
    throw new Error(`Szezonok betöltési hiba: ${formatSupabaseError(seasonsError)}`);
  }
  if (seasons.length === 0) {
    console.error('❌ Nincs szezon a seasons táblában.');
    process.exit(1);
  }

  const seasonYearIndex = buildSeasonYearIndex(seasons);
  const trackedStartYears = Array.from(seasonYearIndex.keys()).sort((a, b) => a - b);
  console.log(`📅 Nyomon követett szezonok: ${seasons.map(s => s.name).join(', ')}`);

  const { data: existingMap } = await supabase
    .from('kosarstat_team_map')
    .select('team_id, kosarstat_team_id, kosarstat_team_name');
  const mapByTeamId = new Map<string, KosarstatTeamMapRow>();
  (existingMap || []).forEach(row => mapByTeamId.set(row.team_id, row));

  const browser = await chromium.launch({ headless: KOSARSTAT_HEADLESS });
  const page = await browser.newPage();

  try {
    const teamsMissingMap = trackedTeams.filter(team => !mapByTeamId.has(team.id));
    if (teamsMissingMap.length > 0) {
      const resolved = await resolveTeamMap(page, teamsMissingMap);
      await upsertTeamMap(resolved);
      resolved.forEach(row => mapByTeamId.set(row.team_id, row));
    }

    const allUnmatchedLabels = new Set<string>();
    let processedTeams = 0;

    for (const [index, team] of trackedTeams.entries()) {
      const mapRow = mapByTeamId.get(team.id);
      if (!mapRow) {
        console.warn(`\n[${index + 1}/${trackedTeams.length}] ⚠️ ${team.name} – nincs kosarstat párosítás, kihagyva`);
        continue;
      }

      console.log(`\n[${index + 1}/${trackedTeams.length}] ${team.name} (kosarstat team=${mapRow.kosarstat_team_id})`);
      const roster = await scrapeTeamPlayers(page, mapRow.kosarstat_team_id);
      if (roster.length === 0) {
        console.warn('  ⚠️ Nincs olvasható archívum-adat, csapat kihagyva.');
        continue;
      }

      await upsertLeaguePlayers(roster);
      const { rowsUpserted, unmatchedSeasonLabels } = await upsertTeamSeasons(
        team.id,
        roster,
        seasonYearIndex,
        trackedStartYears
      );
      unmatchedSeasonLabels.forEach(label => allUnmatchedLabels.add(label));

      console.log(`  ✅ ${rowsUpserted} játékos-szezon sor beírva`);
      processedTeams += 1;

      await page.waitForTimeout(1500);
    }

    console.log(`\n✨ Kész! ${processedTeams}/${trackedTeams.length} csapat feldolgozva.`);
    if (allUnmatchedLabels.size > 0) {
      console.warn(
        `⚠️ ${allUnmatchedLabels.size} szezon-label nem illeszthető a seasons táblára (season_id=NULL maradt): `
        + Array.from(allUnmatchedLabels).join(', ')
      );
    }
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
