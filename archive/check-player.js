require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  console.log('\n=== Keresés: Edwin, Deon, Javern ===');
  const { data: searchData, error: searchError } = await supabase
    .from('player_season_stats')
    .select('name, number, position, games_played, total_points')
    .or('name.ilike.%Edwin%,name.ilike.%Deon%,name.ilike.%Javern%')
    .order('name');
  
  if (searchError) {
    console.error('Keresés hiba:', searchError);
  } else {
    console.log('Találatok:', JSON.stringify(searchData, null, 2));
  }

  console.log('\n=== Összes játékos (első 20) ===');
  const { data: allPlayers, error: allError } = await supabase
    .from('player_season_stats')
    .select('name, number, position, games_played, total_points')
    .order('name')
    .limit(20);
  
  if (allError) {
    console.error('Lista hiba:', allError);
  } else {
    console.log('Játékosok:');
    allPlayers.forEach(p => {
      console.log(`  ${p.number}. ${p.name} (${p.position}) - ${p.games_played} meccs, ${p.total_points} pont`);
    });
  }

  console.log('\n=== Players tábla ellenőrzése ===');
  const { data: playersTable, error: playersError } = await supabase
    .from('players')
    .select('id, name, number, position')
    .or('name.ilike.%Edwin%,name.ilike.%Deon%,name.ilike.%Javern%')
    .order('name');
  
  if (playersError) {
    console.error('Players tábla hiba:', playersError);
  } else {
    console.log('Players táblában:', JSON.stringify(playersTable, null, 2));
  }
})();
