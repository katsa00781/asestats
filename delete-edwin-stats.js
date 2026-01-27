require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== Edwin rossz adatának törlése ===');
  
  // Edwin ID
  const { data: edwin } = await supabase
    .from('players')
    .select('id, name')
    .eq('name', 'Edwin Deon Javern')
    .single();
  
  console.log('Edwin ID:', edwin?.id);
  
  // Töröljük az összes meccs statisztikáját
  const { data: deleted, error } = await supabase
    .from('player_game_stats')
    .delete()
    .eq('player_id', edwin?.id)
    .select();
  
  if (error) {
    console.error('Hiba:', error);
  } else {
    console.log(`✓ Törölve ${deleted?.length || 0} meccs statisztika`);
    deleted?.forEach(d => {
      console.log(`  - ${d.points} pont, ${d.minutes} perc`);
    });
  }
  
  // Ellenőrzés
  const { data: remaining } = await supabase
    .from('player_game_stats')
    .select('*')
    .eq('player_id', edwin?.id);
  
  console.log(`\nMegmaradt Edwin statisztikák: ${remaining?.length || 0}`);
})();
