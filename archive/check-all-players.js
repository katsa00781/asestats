require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== Összes játékos akinek VAN meccs adata ===');
  const { data: playersWithGames } = await supabase
    .from('player_game_stats')
    .select('player_id, players(name, number)')
    .order('player_id');
  
  const uniquePlayers = {};
  playersWithGames?.forEach(stat => {
    const player = stat.players;
    if (player && !uniquePlayers[player.name]) {
      uniquePlayers[player.name] = player.number;
    }
  });
  
  const sortedPlayers = Object.entries(uniquePlayers).sort((a, b) => a[0].localeCompare(b[0]));
  console.log('Játékosok akiknek VAN adata:');
  sortedPlayers.forEach(([name, number]) => {
    console.log(`  ${number}. ${name}`);
  });
  
  console.log('\n=== Összes játékos a players táblában ===');
  const { data: allPlayers } = await supabase
    .from('players')
    .select('name, number')
    .order('number');
  
  allPlayers?.forEach(p => {
    const hasData = uniquePlayers[p.name] !== undefined;
    console.log(`  ${p.number}. ${p.name} ${hasData ? '✓' : '✗ NINCS MECCS ADATA'}`);
  });
})();
