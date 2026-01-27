const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPositions() {
  const { data, error } = await supabase
    .from('players')
    .select('position, team_id, teams(name)')
    .order('team_id');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Group by position
  const positionCounts = {};
  data.forEach(player => {
    const pos = player.position || 'NULL';
    if (!positionCounts[pos]) {
      positionCounts[pos] = { count: 0, teams: new Set() };
    }
    positionCounts[pos].count++;
    if (player.teams) {
      positionCounts[pos].teams.add(player.teams.name);
    }
  });
  
  console.log('\n=== Pozíciók az adatbázisban ===\n');
  Object.keys(positionCounts).sort().forEach(pos => {
    const teams = [...positionCounts[pos].teams].join(', ');
    console.log(`${pos}: ${positionCounts[pos].count} játékos - ${teams}`);
  });

  // Group by team
  console.log('\n=== Csapatonkénti pozíciók ===\n');
  const teamPositions = {};
  data.forEach(player => {
    const teamName = player.teams?.name || 'Unknown';
    if (!teamPositions[teamName]) {
      teamPositions[teamName] = new Set();
    }
    teamPositions[teamName].add(player.position);
  });

  Object.keys(teamPositions).sort().forEach(team => {
    const positions = [...teamPositions[team]].sort().join(', ');
    console.log(`${team}: ${positions}`);
  });
}

checkPositions();
