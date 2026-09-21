import type { PlayerMovement } from '../lib/player-movements';
import { parsePlayerMovement, playerProfileUrl, groupPlayerMovements } from '../lib/player-movements';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const row: PlayerMovement = {
  id: 'membership:arrival', kosarstat_player_id: 'opaque-id', team_id: 'team-a', season_id: 'season-a',
  season_name: '2026/2027', previous_season_name: '2025/2026', direction: 'arrival', movement_type: 'return',
  counterpart_team_ids: [], counterpart_team_names: [], gap_seasons: 1, status_at_time: null,
  imported_at: '2026-09-21T12:00:00Z', display_name: 'Minta Játékos', position: 'G', profile_url: null, team_name: 'ASE',
};
test('A hibás adat nem lesz látszólag érvényes nulla vagy elvesző táblázatsor', () => {
  assert.deepEqual(parsePlayerMovement(row), row);
  for (const patch of [{ gap_seasons: '1' }, { direction: 'other' }, { counterpart_team_ids: null }, { display_name: '' }, { status_at_time: 'U23' }]) {
    assert.throws(() => parsePlayerMovement({ ...row, ...patch }));
  }
});
test('A játékoslink csak a valódi HTTPS Kosarstat profilra mutathat', () => {
  for (const value of ['javascript:alert(1)', 'https://kosarstat.hu.evil.test/players/player/?player=a', 'http://kosarstat.hu/players/player/?player=a', 'https://kosarstat.hu/']) {
    assert.equal(playerProfileUrl(value), null);
  }
  assert.equal(playerProfileUrl('https://kosarstat.hu/players/player/?player=opaque-id'), 'https://kosarstat.hu/players/player/?player=opaque-id');
});
test('A liganézet azonos nevű klubokat is azonosítóval választ szét', () => {
  const groups=groupPlayerMovements([row,{...row,id:'another',team_id:'team-b',direction:'departure'}]);
  assert.equal(groups.length,2);
  assert.equal(groups[0].arrivals.length,1);
  assert.equal(groups[1].departures.length,1);
});
