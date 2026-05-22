/**
 * Egyetlen meccs tesztelése
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testOneGame() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const testUrl = 'https://hunbasket.hu/merkozes/x2526/hun/hun_122723';
    console.log('🧪 Teszt meccs:', testUrl);
    
    await page.goto(testUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    // Dátum
    const bodyText = await page.textContent('body') || '';
    const dateMatch = bodyText.match(/(\d{4})\s*\.\s*(\d{2})\s*\.\s*(\d{2})/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
    console.log('📅 Dátum:', date);

    // Eredmény
    const scoreMatch = bodyText.match(/(\d{2,3})\s*-\s*(\d{2,3})/);
    console.log('🔢 Eredmény:', scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : 'nem található');

    // Csapatok
    const teamLinks = await page.locator('a[href*="/csapat/"]').all();
    const team1 = teamLinks.length > 0 ? (await teamLinks[0].textContent() || '').trim() : '';
    const team2 = teamLinks.length > 1 ? (await teamLinks[1].textContent() || '').trim() : '';
    console.log('🏀 Hazai:', team1);
    console.log('🏀 Vendég:', team2);

    const isHomeGame = team1.includes('Atomerőmű SE');
    console.log('🏠 ASE hazai?', isHomeGame);

    // Játékosok
    const tables = await page.locator('table').filter({ has: page.locator('td') }).all();
    const targetTable = isHomeGame ? tables[0] : tables[1];
    const rows = await targetTable.locator('tbody tr').all();
    
    console.log('\n📋 Játékosok:', rows.length);
    
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const cells = await rows[i].locator('td').all();
      if (cells.length < 15) continue;

      const number = await cells[0].textContent();
      const nameText = (await cells[1].textContent() || '').replace(/\s+/g, ' ').trim();
      const name = nameText.split(' ').slice(0, 2).join(' ');
      const minutes = await cells[4].textContent();
      const points = (parseInt(await cells[5].textContent() || '0') * 2) + 
                    (parseInt(await cells[11].textContent() || '0') * 3) + 
                    parseInt(await cells[14].textContent() || '0');

      console.log(`  ${number}. ${name} - ${minutes} perc, ${points} pont`);
    }

    // ASE csapat ID ellenőrzése
    console.log('\n🔍 ASE csapat ellenőrzése Supabase-ben...');
    const { data: aseTeam, error } = await supabase
      .from('teams')
      .select('id, name')
      .eq('name', 'ASE')
      .single();

    if (error || !aseTeam) {
      console.error('❌ ASE csapat nem található!', error);
    } else {
      console.log('✅ ASE csapat ID:', aseTeam.id);
    }

    // Szezon ellenőrzése
    const { data: season } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('name', '2025/2026')
      .single();

    if (season) {
      console.log('✅ Szezon ID:', season.id);
    } else {
      console.error('❌ 2025/2026 szezon nem található!');
    }

  } catch (error) {
    console.error('❌ Hiba:', error);
  } finally {
    await browser.close();
  }
}

testOneGame();
