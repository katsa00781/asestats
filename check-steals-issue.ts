import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSteals() {
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .ilike('name', '%Edosomwan%');
  
  if (players && players.length > 0) {
    console.log('Játékos:', players[0].name);
    
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('steals, turnovers')
      .eq('player_id', players[0].id);
    
    if (stats) {
      const totalSteals = stats.reduce((sum, s) => sum + (s.steals || 0), 0);
      const totalTurnovers = stats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      
      console.log('\nJelenlegi adatbázis:');
      console.log('Steals összesen:', totalSteals);
      console.log('Turnovers összesen:', totalTurnovers);
      console.log('\nKellene:');
      console.log('Steals: 4');
      console.log('Turnovers: 23');
      console.log('\nValószínű probléma: fel vannak cserélve!');
    }
  }
}

checkSteals();
