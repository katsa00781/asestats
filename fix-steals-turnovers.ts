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

async function fixStealsAndTurnovers() {
  console.log('Steals és turnovers felcserélése az adatbázisban...\n');
  
  // Lekérjük az összes rekordot, ahol van steals VAGY turnovers adat
  const { data: records, error } = await supabase
    .from('player_game_stats')
    .select('id, player_id, steals, turnovers')
    .or('steals.neq.0,turnovers.neq.0');
  
  if (error) {
    console.error('Hiba:', error);
    return;
  }
  
  if (!records || records.length === 0) {
    console.log('Nincs javítandó rekord.');
    return;
  }
  
  console.log(`${records.length} rekord frissítése...`);
  
  // Felcseréljük a steals és turnovers értékeket
  for (const record of records) {
    const { error: updateError } = await supabase
      .from('player_game_stats')
      .update({
        steals: record.turnovers, // A turnovers érték kerül a steals-be
        turnovers: record.steals,  // A steals érték kerül a turnovers-be
      })
      .eq('id', record.id);
    
    if (updateError) {
      console.error(`Hiba a ${record.id} rekord frissítésekor:`, updateError);
    }
  }
  
  console.log('\nEllenőrzés: Edosomwan statisztikái a javítás után...');
  
  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .ilike('name', '%Edosomwan%');
  
  if (players && players.length > 0) {
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('steals, turnovers')
      .eq('player_id', players[0].id);
    
    if (stats) {
      const totalSteals = stats.reduce((sum, s) => sum + (s.steals || 0), 0);
      const totalTurnovers = stats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      
      console.log('\nEdosomwan Kinsley Nehizena:');
      console.log('Steals:', totalSteals, '(kellene: 4)');
      console.log('Turnovers:', totalTurnovers, '(kellene: 23)');
      console.log(totalSteals === 4 && totalTurnovers === 23 ? '✓ Helyes!' : '✗ Még mindig nem jó');
    }
  }
}

fixStealsAndTurnovers();
