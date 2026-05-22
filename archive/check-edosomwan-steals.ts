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

async function checkEdosomwan() {
  // Keressük meg Edosomwan játékost
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .ilike('name', '%Edosomwan%');
  
  if (players && players.length > 0) {
    console.log('Talált játékos:', players[0].name);
    
    // Lekérjük a steals és turnovers statisztikákat
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('steals, turnovers, game_date')
      .eq('player_id', players[0].id)
      .order('game_date', { ascending: false });
    
    if (stats) {
      const totalSteals = stats.reduce((sum, s) => sum + (s.steals || 0), 0);
      const totalTurnovers = stats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      
      console.log('\nÖsszesen:');
      console.log('Steals (labdaszerzés):', totalSteals, '(kellene: 4)');
      console.log('Turnovers (labdaeladás):', totalTurnovers, '(kellene: 23)');
      console.log('\nMeccsenkénti bontás:');
      stats.forEach(s => {
        console.log(`${s.game_date}: Steals=${s.steals || 0}, TO=${s.turnovers || 0}`);
      });
    }
  } else {
    console.log('Nem találtam Edosomwan nevű játékost');
  }
}

checkEdosomwan();
