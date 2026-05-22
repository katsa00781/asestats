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

async function handlePlayerTransfer() {
  console.log('🔄 Hicks Tony Hollis átigazolás kezelése...\n');
  
  // KONFIGURÁCIÓ
  const OLD_PLAYER_NAME = 'Hicks Tony Hollis'; // Távozó játékos neve
  const NEW_PLAYER_NAME = 'Hawkins Elijah Jamil'; // Az új játékos neve
  const JERSEY_NUMBER = 3; // Mezes szám
  const NEW_PLAYER_BIRTH_YEAR = 2002;
  const NEW_PLAYER_HEIGHT = 180;
  const NEW_PLAYER_WEIGHT = 75;
  const NEW_PLAYER_POSITION = '1'; // Irányító
  const LAST_GAME_DATE = '2026-01-24'; // Az első meccs dátuma amikor az új játékos játszott
  
  console.log('Konfiguráció:');
  console.log(`- Távozó játékos: ${OLD_PLAYER_NAME}`);
  console.log(`- Új játékos: ${NEW_PLAYER_NAME}`);
  console.log(`- Mezes szám: #${JERSEY_NUMBER}`);
  console.log(`- Utolsó meccs dátuma: ${LAST_GAME_DATE}\n`);
  
  // 1. Megkeressük Tony Hicks-et
  const { data: oldPlayer } = await supabase
    .from('players')
    .select('id, name, number, team_id, season_id')
    .ilike('name', `%${OLD_PLAYER_NAME}%`)
    .single();
  
  if (!oldPlayer) {
    console.log(`❌ Nem találtam ${OLD_PLAYER_NAME} nevű játékost`);
    return;
  }
  
  console.log(`✓ Megtaláltam: ${oldPlayer.name} (#${oldPlayer.number})`);
  console.log(`  Team ID: ${oldPlayer.team_id}, Season ID: ${oldPlayer.season_id}`);
  
  // 2. Megkeressük az utolsó meccs statisztikáit
  const { data: lastGameStats } = await supabase
    .from('player_game_stats')
    .select('*, games(date, opponent)')
    .eq('player_id', oldPlayer.id)
    .gte('game_date', LAST_GAME_DATE)
    .order('game_date', { ascending: false });
  
  if (!lastGameStats || lastGameStats.length === 0) {
    console.log(`❌ Nem találtam ${LAST_GAME_DATE} utáni meccseket ${oldPlayer.name} számára`);
  } else {
    console.log(`\n✓ Talált meccsek (${lastGameStats.length} db):`);
    lastGameStats.forEach(stat => {
      console.log(`  - ${stat.game_date}: ${stat.points} pont`);
    });
  }
  
  // 3. Létrehozzuk az új játékost
  console.log(`\n📝 Új játékos létrehozása: ${NEW_PLAYER_NAME} (#${JERSEY_NUMBER})`);
  
  const { data: newPlayer, error: newPlayerError } = await supabase
    .from('players')
    .insert({
      name: NEW_PLAYER_NAME,
      number: JERSEY_NUMBER,
      position: NEW_PLAYER_POSITION,
      birth_year: NEW_PLAYER_BIRTH_YEAR,
      height: NEW_PLAYER_HEIGHT,
      weight: NEW_PLAYER_WEIGHT,
      team_id: oldPlayer.team_id,
      season_id: oldPlayer.season_id,
    })
    .select()
    .single();
  
  if (newPlayerError) {
    console.error('❌ Hiba az új játékos létrehozásakor:', newPlayerError);
    return;
  }
  
  console.log(`✓ Új játékos létrehozva: ${newPlayer.name} (ID: ${newPlayer.id})`);
  
  // 4. Az utolsó meccs(ek) statjait átírjuk az új játékosra
  if (lastGameStats && lastGameStats.length > 0) {
    console.log(`\n🔄 ${lastGameStats.length} meccs statjainak áthelyezése...`);
    
    for (const stat of lastGameStats) {
      const { error: updateError } = await supabase
        .from('player_game_stats')
        .update({ player_id: newPlayer.id })
        .eq('id', stat.id);
      
      if (updateError) {
        console.error(`❌ Hiba a ${stat.game_date} meccs frissítésekor:`, updateError);
      } else {
        console.log(`  ✓ ${stat.game_date} - áthelyezve`);
      }
    }
  }
  
  // 5. Tony Hicks törlése vagy megjegyzés hozzáadása
  console.log(`\n🗑️ ${OLD_PLAYER_NAME} kezelése:`);
  console.log('Válaszd ki az egyik opciót:');
  console.log('  A) Törlöm a játékost (ha nincs más statja)');
  console.log('  B) Átnevezem "TÁVOZOTT - Tony Hicks"-re');
  console.log('  C) Megtartom változatlanul');
  
  // Ellenőrizzük, van-e más statja
  const { data: remainingStats } = await supabase
    .from('player_game_stats')
    .select('id')
    .eq('player_id', oldPlayer.id);
  
  if (remainingStats && remainingStats.length > 0) {
    console.log(`\n⚠️ ${OLD_PLAYER_NAME}-nek még van ${remainingStats.length} meccs statisztikája.`);
    console.log('Átnevezem "TÁVOZOTT - Tony Hicks"-re, hogy ne tévesszen meg.');
    
    await supabase
      .from('players')
      .update({ name: `TÁVOZOTT - ${OLD_PLAYER_NAME}` })
      .eq('id', oldPlayer.id);
    
    console.log('✓ Átnevezve');
  } else {
    console.log(`\n✓ ${OLD_PLAYER_NAME}-nek nincs több meccs statisztikája, törölhető.`);
    
    await supabase
      .from('players')
      .delete()
      .eq('id', oldPlayer.id);
    
    console.log('✓ Törölve');
  }
  
  console.log('\n✅ Kész! Ellenőrizd a játékoslistát.');
}

handlePlayerTransfer();
