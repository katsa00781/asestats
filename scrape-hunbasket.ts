/**
 * HUNBASKET.HU SCRAPER - ASE Meccsek Automatikus Importálása
 * 
 * Ez a script automatikusan letölti és importálja az ASE meccseket a hunbasket.hu oldalról
 * 
 * HASZNÁLAT:
 * 1. npm install playwright
 * 2. npx playwright install chromium
 * 3. npx ts-node scrape-hunbasket.ts
 */

import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Környezeti változók betöltése
dotenv.config({ path: '.env.local' });

// Supabase konfiguráció
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók! Ellenőrizd a .env.local fájlt!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface PlayerStats {
  number: number;
  name: string;
  minutes: number;
  points: number;
  twoPointers: { made: number; attempted: number };
  threePointers: { made: number; attempted: number };
  freeThrows: { made: number; attempted: number };
  rebounds: { offensive: number; defensive: number; total: number };
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  fouls: number;
  valuation: number;
}

interface GameData {
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  ourScore: number;
  oppScore: number;
  result: 'win' | 'loss';
  players: PlayerStats[];
}

/**
 * Meccslista letöltése a hunbasket.hu-ról
 */
async function getGameLinks(page: Page): Promise<{ date: string; url: string; homeTeam: string; awayTeam: string; score: string }[]> {
  console.log('📋 Meccslista letöltése...');
  
  await page.goto('https://hunbasket.hu/menetrend-teljes/ferfi/x2526/hun');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // ÖSSZES meccs letöltése
  const games = await page.$$eval('table tbody tr', (rows) => {
    const allGames: { date: string; url: string; homeTeam: string; awayTeam: string; score: string }[] = [];
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return;

      const team1 = cells[1]?.textContent?.trim() || '';
      const scoreText = cells[2]?.textContent?.trim() || '';
      const team2 = cells[3]?.textContent?.trim() || '';
      const dateText = cells[4]?.textContent?.trim() || '';
      
      // Link keresése - vagy 'merkozes' vagy 'osszefoglalo'
      const summaryLink = row.querySelector('a[href*="merkozes"]') as HTMLAnchorElement;

      // Csak befejezett meccsek (nem 0–0)
      if (summaryLink && scoreText && !scoreText.includes('0–0') && scoreText.match(/\d+–\d+/)) {
        allGames.push({
          date: dateText,
          url: summaryLink.href,
          homeTeam: team1,
          awayTeam: team2,
          score: scoreText
        });
      }
    });

    return allGames;
  });

  console.log(`✅ ${games.length} befejezett meccs találva`);
  return games;
}

/**
 * Egy meccs részleteinek letöltése
 */
async function scrapeGameDetails(page: Page, gameUrl: string): Promise<GameData | null> {
  try {
    console.log(`  📥 Letöltés: ${gameUrl}`);
    
    await page.goto(gameUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Várunk a teljes betöltésre

    // Dátum kinyerése a teljes oldalból
    const bodyText = await page.textContent('body') || '';
    const dateMatch = bodyText.match(/(\d{4})\s*\.\s*(\d{2})\s*\.\s*(\d{2})/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];

    // Eredmény kinyerése
    const scoreMatch = bodyText.match(/(\d{2,3})\s*-\s*(\d{2,3})/);
    if (!scoreMatch) {
      throw new Error('Nem található az eredmény');
    }
    
    const score1 = parseInt(scoreMatch[1]);
    const score2 = parseInt(scoreMatch[2]);

    // Csapatnevek
    const teamLinks = await page.locator('a[href*="/csapat/"]').all();
    const team1Link = teamLinks.length > 0 ? (await teamLinks[0].textContent() || '').trim() : '';
    const team2Link = teamLinks.length > 1 ? (await teamLinks[1].textContent() || '').trim() : '';
    
    const isHomeGame = team1Link.includes('ATOMERŐMŰ SE') || team1Link.includes('Atomerőmű SE');
    
    const ourScore = isHomeGame ? score1 : score2;
    const oppScore = isHomeGame ? score2 : score1;
    const opponent = isHomeGame ? team2Link : team1Link;
    const homeAway: 'home' | 'away' = isHomeGame ? 'home' : 'away';
    const result: 'win' | 'loss' = ourScore > oppScore ? 'win' : 'loss';

    // Játékosok statisztikái
    const players = await scrapePlayerStats(page, isHomeGame);

    const gameData: GameData = {
      date,
      opponent: opponent.trim(),
      homeAway,
      ourScore,
      oppScore,
      result,
      players
    };

    console.log(`  ✅ Letöltve: ${opponent} (${ourScore}-${oppScore}), ${players.length} játékos`);
    return gameData;

  } catch (error) {
    console.error(`  ❌ Hiba: ${error}`);
    return null;
  }
}

/**
 * Játékosok statisztikáinak kinyerése a táblázatból
 */
async function scrapePlayerStats(page: Page, isHomeTeam: boolean): Promise<PlayerStats[]> {
  // Két statisztika táblázat van (home és away), kiválasztjuk az ASE-ét
  const tables = await page.locator('table').filter({ has: page.locator('td') }).all();
  
  if (tables.length < 2) {
    console.warn('  ⚠️  Nem található két statisztika táblázat!');
    return [];
  }

  // Az első táblázat a hazai, a második a vendég csapat
  const targetTable = isHomeTeam ? tables[0] : tables[1];
  
  const rows = await targetTable.locator('tbody tr').all();
  const players: PlayerStats[] = [];

  for (const row of rows) {
    const cells = await row.locator('td').all();
    
    // Ellenőrizzük, hogy elég cella van-e (legalább 15)
    if (cells.length < 15) continue;

    // A táblázat struktúrája:
    // 0: mezszám, 1: név, 2: *, 3: VAL, 4: perc
    // 5-6: 2p made/att, 7: %, 8-9: 2p köz made/att, 10: %
    // 11-12: 3p made/att, 13: %, 14-15: büntető made/att, 16: %
    // 17-18: lepattanó (táv/véd), 19: össz, 20: gólpassz
    // 21: labdaszerzés, 22: labdaeladás, 23: fault, 24: blokk
    // 25: kapott blokk, 26: technikai, 27: pontszám

    const number = parseInt(await cells[0].textContent() || '0');
    const nameText = await cells[1].textContent() || '';
    // Név tisztítása - többszörös whitespace eltávolítása
    const name = nameText.replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');

    const valuation = parseInt(await cells[3].textContent() || '0');
    const minutes = parseInt(await cells[4].textContent() || '0');
    
    // 2 pontos összesen (köz + táv)
    const twoMade = parseInt(await cells[5].textContent() || '0');
    const twoAtt = parseInt(await cells[6].textContent() || '0');
    
    // 3 pontos
    const threeMade = parseInt(await cells[11].textContent() || '0');
    const threeAtt = parseInt(await cells[12].textContent() || '0');
    
    // Büntető
    const ftMade = parseInt(await cells[14].textContent() || '0');
    const ftAtt = parseInt(await cells[15].textContent() || '0');
    
    // Pontok számítása
    const points = (twoMade * 2) + (threeMade * 3) + ftMade;
    
    // Lepattanók
    const offensive = parseInt(await cells[17].textContent() || '0');
    const defensive = parseInt(await cells[18].textContent() || '0');
    
    // Egyéb statisztikák
    const assists = parseInt(await cells[20].textContent() || '0');
    const steals = parseInt(await cells[21].textContent() || '0');
    const turnovers = parseInt(await cells[22].textContent() || '0');
    const fouls = parseInt(await cells[23].textContent() || '0');
    const blocks = parseInt(await cells[24].textContent() || '0');

    players.push({
      number,
      name,
      minutes,
      points,
      twoPointers: { made: twoMade, attempted: twoAtt },
      threePointers: { made: threeMade, attempted: threeAtt },
      freeThrows: { made: ftMade, attempted: ftAtt },
      rebounds: {
        offensive,
        defensive,
        total: offensive + defensive
      },
      assists,
      steals,
      turnovers,
      blocks,
      fouls,
      valuation
    });
  }

  return players.filter(p => p.minutes > 0); // Csak akik játszottak
}

/**
 * Meccs importálása Supabase-be
 */
async function importGameToSupabase(gameData: GameData): Promise<void> {
  console.log(`  💾 Importálás: ${gameData.opponent} (${gameData.date})`);

  // 1. Csapat ID lekérése a meccs based on homeAway
  // Ha home, akkor az opponent a vendég csapat neve
  // Ha away, akkor a mi csapatunk az opponent
  let ourTeamName = '';
  
  // Próbáljuk meg azonosítani melyik csapat játékosait importáljuk
  // A gameData.players a mi csapatunk játékosai
  if (gameData.players.length > 0) {
    // Először nézzük meg van-e olyan játékos aki már létezik
    const firstPlayer = gameData.players[0];
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('team_id, teams(name)')
      .eq('name', firstPlayer.name)
      .single();
    
    if (existingPlayer && existingPlayer.teams) {
      ourTeamName = (existingPlayer.teams as any).name;
      console.log(`  ℹ️  Csapat azonosítva játékos alapján: ${ourTeamName}`);
    }
  }
  
  // Ha nem találtuk meg, alapértelmezett ASE (később javítható)
  if (!ourTeamName) {
    ourTeamName = 'ASE';
    console.log(`  ⚠️  Csapat nem azonosítható, használom: ${ourTeamName}`);
  }

  const { data: ourTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('name', ourTeamName)
    .single();

  if (!ourTeam) {
    console.error(`  ❌ ${ourTeamName} csapat nem található!`);
    return;
  }

  // 2. Szezon ID lekérése
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', '2025/2026')
    .single();

  if (!season) {
    console.error('  ❌ 2025/2026 szezon nem található!');
    return;
  }

  // 3. Ellenőrizzük hogy a meccs már létezik-e (dátum + opponent + csapat alapján)
  const { data: existingGame } = await supabase
    .from('games')
    .select('id')
    .eq('date', gameData.date)
    .eq('opponent', gameData.opponent)
    .eq('our_team_id', ourTeam.id)
    .single();

  if (existingGame) {
    console.log(`  ⏭️  Meccs már létezik, kihagyom`);
    return;
  }

  // 4. Meccs létrehozása
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      date: gameData.date,
      our_team_id: ourTeam.id,
      opponent: gameData.opponent,
      home_away: gameData.homeAway,
      our_score: gameData.ourScore,
      opp_score: gameData.oppScore,
      result: gameData.result,
      season_id: season.id
    })
    .select()
    .single();

  if (gameError || !game) {
    console.error(`  ❌ Meccs létrehozása sikertelen: ${gameError?.message}`);
    return;
  }

  console.log(`  ✅ Meccs létrehozva: ${game.id}`);

  // 4. Játékosok statisztikáinak importálása
  for (const player of gameData.players) {
    // Játékos ID lekérése név alapján
    const { data: playerData } = await supabase
      .from('players')
      .select('id')
      .eq('name', player.name)
      .eq('team_id', ourTeam.id)
      .single();

    if (!playerData) {
      console.warn(`  ⚠️  Játékos nem található: ${player.name} (${ourTeamName})`);
      continue;
    }

    // Player_game_stats létrehozása
    // Hunbasket csak 2p összesen-t ad, mi pedig close+mid-et tárolunk
    // Egyelőre az összeset close-ként tároljuk
    const { error: statsError } = await supabase
      .from('player_game_stats')
      .insert({
        game_id: game.id,
        player_id: playerData.id,
        minutes: player.minutes,
        points: player.points,
        close_made: player.twoPointers.made,
        close_attempted: player.twoPointers.attempted,
        mid_made: 0,
        mid_attempted: 0,
        three_made: player.threePointers.made,
        three_attempted: player.threePointers.attempted,
        free_throw_made: player.freeThrows.made,
        free_throw_attempted: player.freeThrows.attempted,
        offensive_rebounds: player.rebounds.offensive,
        defensive_rebounds: player.rebounds.defensive,
        total_rebounds: player.rebounds.total,
        assists: player.assists,
        steals: player.steals,
        turnovers: player.turnovers,
        blocks: player.blocks,
        fouls_committed: player.fouls,
        valuation: player.valuation
      });

    if (statsError) {
      console.error(`  ❌ ${player.name} statisztika hiba: ${statsError.message}`);
    } else {
      console.log(`  ✅ ${player.name} statisztika importálva`);
    }
  }
}

/**
 * FŐPROGRAM
 */
async function main() {
  console.log('🚀 HUNBASKET.HU SCRAPER INDÍTÁSA\n');

  const browser = await chromium.launch({ headless: false }); // headless: true = háttérben fut
  const page = await browser.newPage();

  try {
    // 1. Meccslista letöltése
    const gameLinks = await getGameLinks(page);

    if (gameLinks.length === 0) {
      console.log('❌ Nincsenek ASE meccsek!');
      return;
    }

    console.log(`\n📊 ${gameLinks.length} meccs feldolgozása...\n`);

    // 2. Minden meccs letöltése és importálása
    for (const [index, gameLink] of gameLinks.entries()) {
      console.log(`\n[${index + 1}/${gameLinks.length}] ${gameLink.homeTeam} vs ${gameLink.awayTeam} (${gameLink.score})`);
      
      const gameData = await scrapeGameDetails(page, gameLink.url);
      
      if (gameData) {
        await importGameToSupabase(gameData);
      }

      // Kis szünet, hogy ne terheljük túl a szervert
      await page.waitForTimeout(2000);
    }

    console.log('\n✅ KÉSZ! Minden meccs importálva!');

  } catch (error) {
    console.error('❌ HIBA:', error);
  } finally {
    await browser.close();
  }
}

// Script futtatása
main();
