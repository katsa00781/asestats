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

const playersData = [
  { number: 0, birth_year: 1992, position: '1-2 (Irányító/Dobóhátvéd)', height: 194, weight: 100 },
  { number: 1, birth_year: 2006, position: '3-4 (Kiscsatár/Erőcsatár)', height: 193, weight: 89 },
  { number: 2, birth_year: 1994, position: '2-3 (Dobóhátvéd/Kiscsatár)', height: 198, weight: 98 },
  { number: 3, birth_year: 1994, position: '1 (Irányító)', height: 189, weight: 84 },
  { number: 4, birth_year: 1993, position: '5 (Center)', height: 206, weight: 118 },
  { number: 7, birth_year: 1991, position: '4 (Erőcsatár)', height: 200, weight: 103 },
  { number: 10, birth_year: 1995, position: '5 (Center)', height: 200, weight: 108 },
  { number: 11, birth_year: 1995, position: '2-3 (Dobóhátvéd/Kiscsatár)', height: 197, weight: 95 },
  { number: 12, birth_year: 2004, position: '1 (Irányító)', height: 184, weight: 80 },
  { number: 13, birth_year: 2005, position: '3-4 (Kiscsatár/Erőcsatár)', height: 198, weight: 97 },
  { number: 15, birth_year: 2003, position: '5-4 (Center/Erőcsatár)', height: 206, weight: 105 },
  { number: 22, birth_year: 1996, position: '5-4 (Center/Erőcsatár)', height: 202, weight: 98 },
  { number: 41, birth_year: 2003, position: '3 (Kiscsatár)', height: 196, weight: 86 },
];

async function updatePlayers() {
  console.log('Játékosok adatainak frissítése...\n');

  for (const player of playersData) {
    const { data, error } = await supabase
      .from('players')
      .update({
        birth_year: player.birth_year,
        position: player.position,
        height: player.height,
        weight: player.weight,
      })
      .eq('number', player.number)
      .select();

    if (error) {
      console.error(`❌ Hiba a ${player.number}-es játékosnál:`, error);
    } else {
      console.log(`✅ ${player.number}-es játékos frissítve:`, data?.[0]?.name);
    }
  }

  console.log('\n✨ Frissítés kész!');
}

updatePlayers();
