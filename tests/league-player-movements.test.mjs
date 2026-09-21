// A migráció SELECT-je, kizárólag READ ONLY tranzakcióban; nem hoz létre view-t.
// Futtatás: node --test tests/league-player-movements.test.mjs (psql szükséges).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
const migration = readFileSync(new URL('../migrations/add-league-player-movements-view.sql', import.meta.url), 'utf8');
const query = migration.split('WITH (security_invoker = true) AS\n')[1].split(';')[0];
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
function select(sql) {
  assert.ok(dbUrl, 'DATABASE_URL vagy SUPABASE_DB_URL szükséges.');
  const connection = new URL(dbUrl);
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: connection.pathname.slice(1), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15' },
    input: `BEGIN READ ONLY; SET LOCAL statement_timeout = '20s'; SELECT COALESCE(json_agg(result), '[]') FROM (${sql}) result; ROLLBACK;`,
    encoding: 'utf8', timeout: 45_000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout.trim());
}
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const stints = [
  ['stay', 1, 2023], ['stay', 1, 2024], ['stay', 1, 2025], ['stay', 1, 2026],
  ['transfer', 1, 2023], ['transfer', 2, 2024], ['transfer', 2, 2025],
  ['return', 1, 2023], ['return', 1, 2025],
  ['new', 1, 2024], ['leave', 1, 2023],
  ['multi', 1, 2023], ['multi', 2, 2023], ['multi', 3, 2024],
  ['overlap', 1, 2023], ['overlap', 1, 2024], ['overlap', 2, 2024], ['overlap', 2, 2025],
];
const fixtures = `WITH test_seasons(id,name,start_date) AS (VALUES ${[2023,2024,2025,2026].map(y => `('${uuid(y)}'::uuid,'${y}/${y+1}','${y}-09-01'::date)`).join(',')}),
test_teams(id,name) AS (VALUES ${[1,2,3].map(n => `('${uuid(n)}'::uuid,'Csapat ${n}')`).join(',')}),
test_players(kosarstat_player_id,display_name,position,profile_url) AS (VALUES ${[...new Set(stints.map(s=>s[0]))].map(id => `('${id}','${id}',NULL::text,NULL::text)`).join(',')}),
test_memberships(id,kosarstat_player_id,team_id,season_id,status_at_time,imported_at) AS (VALUES ${stints.map(([p,t,y],i)=>`('${uuid(100+i)}'::uuid,'${p}','${uuid(t)}'::uuid,'${uuid(y)}'::uuid,'hazai',CURRENT_TIMESTAMP)`).join(',')}),
${query.slice('WITH '.length).replaceAll('public.seasons','test_seasons').replaceAll('public.teams','test_teams').replaceAll('public.league_players','test_players').replaceAll('public.league_player_team_seasons','test_memberships')}`;
test('Szezonhatárok, csapatváltás, visszatérés, több klub és folyamatos tagság', () => {
  const rows=select(fixtures);
  assert.equal(rows.filter(r=>r.kosarstat_player_id==='stay').length,0);
  assert.equal(rows.filter(r=>r.season_name==='2023/2024').length,0);
  assert.equal(rows.filter(r=>r.season_name==='2027/2028').length,0);
  const transfer=rows.filter(r=>r.kosarstat_player_id==='transfer'&&r.season_name==='2024/2025');
  assert.equal(transfer.length,2);assert.ok(transfer.every(r=>r.movement_type==='domestic_transfer'));
  const returned=rows.find(r=>r.kosarstat_player_id==='return'&&r.direction==='arrival');
  assert.equal(returned.movement_type,'return');assert.equal(returned.gap_seasons,1);
  assert.equal(rows.find(r=>r.kosarstat_player_id==='new'&&r.direction==='arrival').movement_type,'unknown');
  assert.equal(rows.find(r=>r.kosarstat_player_id==='leave').movement_type,'unknown');
  const multi=rows.find(r=>r.kosarstat_player_id==='multi'&&r.direction==='arrival');
  assert.equal(multi.counterpart_team_ids.length,2);
  const overlap=rows.filter(r=>r.kosarstat_player_id==='overlap'&&r.season_name==='2024/2025');
  assert.equal(overlap.length,1);assert.equal(overlap[0].team_id,uuid(2));
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
});
test('Valós import: egyedi mozgások és ismert ASE szezonváltás', () => {
  const rows=select(query);
  assert.ok(rows.length>0,'Előbb a teljes bajnokságot importáld.');
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  assert.ok(rows.every(r=>r.season_name!=='2023/2024'));
  const joseph=rows.find(r=>r.kosarstat_player_id==='joseyasi96'&&r.team_name==='Atomerőmű SE'&&r.season_name==='2026/2027'&&r.direction==='arrival');
  assert.equal(joseph?.movement_type,'domestic_transfer');
  assert.deepEqual(joseph.counterpart_team_names,['Alba Fehérvár']);
  const chandler=rows.find(r=>r.kosarstat_player_id==='chanjayj98'&&r.team_name==='Atomerőmű SE'&&r.season_name==='2026/2027'&&r.direction==='arrival');
  assert.equal(chandler?.movement_type,'return');
  assert.equal(chandler.gap_seasons,1);
  console.log('Valós adat összesítése:',JSON.stringify(rows.reduce((a,r)=>{const k=`${r.season_name} ${r.direction} ${r.movement_type}`;a[k]=(a[k]||0)+1;return a;},{})));
  console.log('ASE minták:',JSON.stringify(rows.filter(r=>r.team_name==='Atomerőmű SE'&&r.season_name==='2026/2027').map(r=>({player:r.display_name,direction:r.direction,type:r.movement_type,teams:r.counterpart_team_names,gap:r.gap_seasons}))));
});
