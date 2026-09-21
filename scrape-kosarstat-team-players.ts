// Játékosmozgás-import: a szezonos csapatoldal VALÓS névsora a tényadat.
// Az archívum első/utolsó éve nem folytonos stint, nem bontható ki évekre.
// 2026-09-21: felhasználó által jóváhagyott forráskorrekció.
import type { Page } from 'playwright';
import type { SourceTable, SeasonPlayer } from './lib/kosarstat-movement-source';
import { parseSeasonPlayers, seasonCode } from './lib/kosarstat-movement-source';
import { fetchAllRows } from './lib/fetch-all-rows';
import { createScriptClient, normalizeName, findTeamByNameFuzzy, formatSupabaseError } from './scrape-utils';
import { chromium } from 'playwright';

const supabase = createScriptClient(); // dotenv az opciók kiolvasása előtt
const seasonCount = Number(process.env.KOSARSTAT_MOVEMENT_SEASON_COUNT || '4');
const filters = (process.env.KOSARSTAT_TEAM_FILTER || '').split(',').map(normalizeName).filter(Boolean);
const dryRun = process.env.KOSARSTAT_MOVEMENT_DRY_RUN === '1';
type Team = { id: string; name: string };
type Season = { id: string; name: string; start_date: string };
type TeamMap = { team_id: string; kosarstat_team_id: string; kosarstat_team_name: string };

async function openPage(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (!response?.ok()) throw new Error(`Forrásoldal nem elérhető: ${response?.status()} ${url}`);
  await page.locator('table').first().waitFor();
  await page.waitForTimeout(1000);
}
async function readTables(page: Page): Promise<SourceTable[]> {
  return page.evaluate(() => {
    type TableApi = {
      rows: () => { nodes: () => { toArray: () => HTMLTableRowElement[] } };
      settings: () => { oFeatures: { bServerSide: boolean } }[];
    };
    type JQuery = ((table: HTMLTableElement) => { DataTable: () => TableApi }) & {
      fn?: { dataTable?: { isDataTable: (table: HTMLTableElement) => boolean } };
    };
    const jq = (window as unknown as { jQuery?: JQuery }).jQuery;
    return Array.from(document.querySelectorAll('table')).flatMap(table => {
      const headers = Array.from(table.querySelectorAll('thead tr:first-child th, thead tr:first-child td')).map(c => c.textContent?.trim() ?? '');
      if (!headers.includes('active') && !headers.includes('team_name_2') && !headers.includes('first_game')) return [];
      let rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'));
      if (jq?.fn?.dataTable?.isDataTable(table)) {
        const api = jq(table).DataTable();
        // A többi lap nincs a DOM-ban. Szerveroldali lapozásra váltáskor
        // megállunk a csonkolás helyett.
        if (api.settings()[0]?.oFeatures.bServerSide) throw new Error('A forrás szerveroldali lapozásra váltott.');
        rows = api.rows().nodes().toArray();
      }
      return {
        headers,
        rows: rows.map(row => ({
          cells: Array.from(row.querySelectorAll('td')).map(cell => {
            const copy = cell.cloneNode(true) as HTMLElement;
            copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            copy.querySelectorAll('p').forEach(p => p.prepend('\n'));
            return copy.textContent?.trim() ?? '';
          }),
          links: Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href]')).map(a => ({ text: a.textContent?.trim() ?? '', url: a.href })),
        })),
      };
    });
  });
}
async function resolveTeamMaps(page: Page, teams: Team[]): Promise<TeamMap[]> {
  const { data: existing, error } = await supabase.from('kosarstat_team_map').select('team_id,kosarstat_team_id,kosarstat_team_name');
  if (error) throw new Error(`Csapattérkép: ${formatSupabaseError(error)}`);
  const existingById = new Map<string, TeamMap>((existing ?? []).map(row => [row.team_id, row]));
  await openPage(page, 'https://kosarstat.hu/teams/');
  const table = (await readTables(page)).find(t => t.headers.includes('Csapat') && t.headers.includes('active'));
  if (!table) throw new Error('A Kosarstat csapatlista nem található.');
  const candidates = table.rows.flatMap(row => {
    const link = row.links.find(link => link.url.includes('/teams/team/'));
    const id = link ? new URL(link.url).searchParams.get('team') : null;
    return link && id ? [{ id, name: link.text, aliases: row.cells[0].split('\n').map(normalizeName).filter(Boolean) }] : [];
  });
  const maps = teams.map(team => {
    const saved = existingById.get(team.id);
    if (saved) return saved;
    // A forrás saját korábbi klubnevei: nincs rövidítés-alapú találgatás.
    const exact = candidates.filter(c => c.aliases.includes(normalizeName(team.name)));
    const matches = exact.length ? exact : candidates.filter(c => findTeamByNameFuzzy([c], team.name));
    if (matches.length !== 1) throw new Error(`Nem egyértelmű csapatpár: ${team.name}. Javítsd a kosarstat_team_map táblát.`);
    return { team_id: team.id, kosarstat_team_id: matches[0].id, kosarstat_team_name: matches[0].name };
  });
  if (new Set(maps.map(m => m.kosarstat_team_id)).size !== maps.length) throw new Error('Több nyomon követett csapat ugyanahhoz a Kosarstat klubhoz tartozik.');
  return maps;
}
async function main() {
  if (seasonCount !== 3 && seasonCount !== 4) throw new Error('A szezonok száma 3 vagy 4 lehet.');
  if (!dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Az importhoz SUPABASE_SERVICE_ROLE_KEY szükséges.');
  const { data: seasons, error: seasonError } = await supabase.from('seasons').select('id,name,start_date')
    .lte('start_date', new Date().toISOString().slice(0, 10)).order('start_date', { ascending: false }).limit(seasonCount);
  if (seasonError || !seasons?.length) throw new Error(`Szezonok: ${formatSupabaseError(seasonError)}`);
  const orderedSeasons: Season[] = [...seasons].reverse();
  orderedSeasons.forEach(s => seasonCode(s.name));
  const fixtures = await fetchAllRows<{ id: string; home_team_id: string; away_team_id: string }>((from, to) => supabase
    .from('league_fixtures').select('id,home_team_id,away_team_id').eq('season_id', seasons[0].id).order('id').range(from, to));
  const currentTeamIds = [...new Set(fixtures.flatMap(f => [f.home_team_id, f.away_team_id]))];
  if (!currentTeamIds.length) throw new Error('Előbb importáld a legújabb szezon menetrendjét a jelenlegi élvonal meghatározásához.');
  const { data: teams, error: teamsError } = await supabase.from('teams').select('id,name').in('id', currentTeamIds).order('name');
  if (teamsError || !teams) throw new Error(`Csapatok: ${formatSupabaseError(teamsError)}`);
  const selectedTeams: Team[] = teams.filter(t => !filters.length || filters.some(f => normalizeName(t.name).includes(f)));
  if (!selectedTeams.length) throw new Error('A csapatszűrő nem talál egyetlen jelenlegi élvonalbeli csapatot sem.');
  console.log(`Játékosmozgás-import${dryRun ? ' (csak ellenőrzés, írás nélkül)' : ''}: ${selectedTeams.length} csapat; ${orderedSeasons.map(s => s.name).join(', ')}`);
  const browser = await chromium.launch({ headless: process.env.KOSARSTAT_HEADLESS !== 'false' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => new URL(route.request().url()).hostname === 'kosarstat.hu' ? route.continue() : route.abort());
    const maps = await resolveTeamMaps(page, selectedTeams);
    const batches: { team: Team; season: Season; players: SeasonPlayer[] }[] = [];
    maps.forEach(map => console.log(`${selectedTeams.find(t => t.id === map.team_id)?.name} → ${map.kosarstat_team_name} (${map.kosarstat_team_id})`));
    await page.close();
    const jobs = selectedTeams.flatMap(team => orderedSeasons.map(season => ({ team, season })));
    let nextJob = 0;
    // Három böngészőlap korlátozza a forrás terhelését és az API futásidejét.
    const results = await Promise.allSettled(Array.from({ length: Math.min(3, jobs.length) }, async () => {
      const workerPage = await browser.newPage();
      await workerPage.route('**/*', route => new URL(route.request().url()).hostname === 'kosarstat.hu' ? route.continue() : route.abort());
      while (nextJob < jobs.length) {
        const { team, season } = jobs[nextJob++];
        const map = maps.find(m => m.team_id === team.id)!;
        await openPage(workerPage, `https://kosarstat.hu/teams/team/boxstats/?team=${encodeURIComponent(map.kosarstat_team_id)}&season=${seasonCode(season.name)}`);
        const tables = await readTables(workerPage);
        const heading = tables.find(t => t.headers.includes('team_name_2'));
        if (!heading?.rows.some(row => row.cells.includes(season.name.replace('/', '-')))) throw new Error(`A forrás más szezont adott vissza: ${team.name} ${season.name}`);
        const players = parseSeasonPlayers(tables);
        const hasTeam = heading.rows.some(row => row.cells.some(c => c && c !== season.name.replace('/', '-')));
        if (!players.length && hasTeam) throw new Error(`Hiányzó játékoslista: ${team.name} ${season.name}. Nem tekintjük üres keretnek.`);
        console.log(`  ${team.name} ${season.name}: ${players.length} játékos${hasTeam ? '' : ' (nem szerepelt az élvonalban)'}`);
        batches.push({ team, season, players });
      }
      await workerPage.close();
    }));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map(f => f.reason), 'A forrásellenőrzés sikertelen; adatbázisírás nem történt.');
    const players = new Map<string, SeasonPlayer>();
    // Szezon szerinti sorrend: a legújabb ismert státusz legyen a törzsadat.
    for (const season of orderedSeasons) for (const batch of batches.filter(b => b.season.id === season.id)) {
      batch.players.forEach(player => players.set(player.kosarstat_player_id, player));
    }
    const memberships = batches.flatMap(b => b.players.map(p => ({
      kosarstat_player_id: p.kosarstat_player_id, team_id: b.team.id, season_id: b.season.id,
      kosarstat_season_label: `${b.season.name.slice(0, 4)}-${b.season.name.slice(-2)}`,
      status_at_time: p.latest_status, imported_at: new Date().toISOString(),
    })));
    if (!memberships.length) throw new Error('Nincs importálható játékos-szezon adat.');
    // A teljes forrásellenőrzés megelőzi az első írást.
    if (!dryRun) {
      const { error: mapError } = await supabase.from('kosarstat_team_map').upsert(maps, { onConflict: 'team_id' });
      if (mapError) throw new Error(formatSupabaseError(mapError));
      const { error: playerError } = await supabase.from('league_players').upsert([...players.values()].map(p => ({ ...p, updated_at: new Date().toISOString() })), { onConflict: 'kosarstat_player_id' });
      if (playerError) throw new Error(formatSupabaseError(playerError));
      const { error: membershipError } = await supabase.from('league_player_team_seasons').upsert(memberships, { onConflict: 'kosarstat_player_id,team_id,kosarstat_season_label' });
      if (membershipError) throw new Error(formatSupabaseError(membershipError));
    }
    console.log(`Kész: ${maps.length} csapat, ${players.size} játékos, ${memberships.length} játékos-szezon sor.${dryRun ? ' Adatbázisírás nem történt.' : ''}`);
  } finally {
    await browser.close();
  }
}
main().catch(error => {
  console.error('Sikertelen játékosmozgás-import:', error);
  process.exitCode = 1;
});
