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

async function checkAllPlayersStealsAndTurnovers() {
  console.log('🔍 Minden játékos steals és turnovers ellenőrzése...\n');
  
  // Lekérjük az összes játékost
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, number')
    .order('name');
  
  if (playersError) {
    console.error('Hiba a játékosok lekérésekor:', playersError);
    return;
  }
  
  if (!players || players.length === 0) {
    console.log('Nincs játékos az adatbázisban.');
    return;
  }
  
  console.log(`Összesen ${players.length} játékos ellenőrzése...\n`);
  
  const results = [];
  
  for (const player of players) {
    const { data: stats } = await supabase
      .from('player_game_stats')
      .select('steals, turnovers')
      .eq('player_id', player.id);
    
    if (stats && stats.length > 0) {
      const totalSteals = stats.reduce((sum, s) => sum + (s.steals || 0), 0);
      const totalTurnovers = stats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      const gamesPlayed = stats.length;
      const avgSteals = gamesPlayed > 0 ? (totalSteals / gamesPlayed).toFixed(1) : '0.0';
      const avgTurnovers = gamesPlayed > 0 ? (totalTurnovers / gamesPlayed).toFixed(1) : '0.0';
      
      results.push({
        name: player.name,
        number: player.number,
        gamesPlayed,
        totalSteals,
        totalTurnovers,
        avgSteals: parseFloat(avgSteals),
        avgTurnovers: parseFloat(avgTurnovers),
        ratio: totalTurnovers > 0 ? (totalSteals / totalTurnovers).toFixed(2) : 'N/A'
      });
    }
  }
  
  // Rendezzük a játékosokat összes labdaszerzés szerint (csökkenő)
  results.sort((a, b) => b.totalSteals - a.totalSteals);
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('Név'.padEnd(30) + ' | #  | M | SZ  | EL  | Átl.SZ | Átl.EL | SZ/EL');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  results.forEach(r => {
    const namePart = r.name.substring(0, 28).padEnd(30);
    const numPart = r.number.toString().padStart(2);
    const gamesPart = r.gamesPlayed.toString().padStart(2);
    const stealsPart = r.totalSteals.toString().padStart(3);
    const turnoversPart = r.totalTurnovers.toString().padStart(3);
    const avgStealsPart = r.avgSteals.toFixed(1).padStart(6);
    const avgTurnoversPart = r.avgTurnovers.toFixed(1).padStart(6);
    const ratioPart = r.ratio.toString().padStart(5);
    
    console.log(`${namePart} | ${numPart} | ${gamesPart} | ${stealsPart} | ${turnoversPart} | ${avgStealsPart} | ${avgTurnoversPart} | ${ratioPart}`);
  });
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('\nJelmagyarázat:');
  console.log('M = Meccsek száma');
  console.log('SZ = Labdaszerzés (steals) összesen');
  console.log('EL = Labdaeladás (turnovers) összesen');
  console.log('SZ/EL = Labdaszerzés/Labdaeladás arány (minél magasabb, annál jobb)');
  
  // Gyanús esetek keresése
  console.log('\n⚠️  Gyanús esetek (ahol a steals/turnovers arány szokatlan):');
  const suspicious = results.filter(r => {
    // Ha több labdaszerzés van, mint labdaeladás (szokatlan)
    return r.totalSteals > r.totalTurnovers && r.totalTurnovers > 0;
  });
  
  if (suspicious.length > 0) {
    suspicious.forEach(r => {
      console.log(`- ${r.name}: ${r.totalSteals} steals vs ${r.totalTurnovers} turnovers (arány: ${r.ratio}) - Ez szokatlan!`);
    });
  } else {
    console.log('Nincs gyanús eset (általában több a labdaeladás, mint a labdaszerzés).');
  }
  
  // Edosomwan külön kiemelése
  const edosomwan = results.find(r => r.name.includes('Edosomwan'));
  if (edosomwan) {
    console.log('\n✓ Edosomwan Kinsley Nehizena:');
    console.log(`  Steals: ${edosomwan.totalSteals} (Átlag: ${edosomwan.avgSteals})`);
    console.log(`  Turnovers: ${edosomwan.totalTurnovers} (Átlag: ${edosomwan.avgTurnovers})`);
    console.log(`  Kellene: 4 steals, 23 turnovers`);
    console.log(`  ${edosomwan.totalSteals === 4 && edosomwan.totalTurnovers === 23 ? '✓ HELYES!' : '✗ HIBÁS - futtasd a fix-steals-db.sql scriptet!'}`);
  }
}

checkAllPlayersStealsAndTurnovers();
