/**
 * TESZT SCRIPT - Egy meccs letöltése próbaképpen
 */

import { chromium } from 'playwright';

async function testScrape() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    const testUrl = 'https://hunbasket.hu/merkozes/x2526/hun/hun_122723';
    console.log('🧪 Teszt meccs letöltése:', testUrl);
    
    await page.goto(testUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Várunk 5 másodpercet

    // Teljes oldal szöveg
    const bodyText = await page.textContent('body') || '';
    const dateMatch = bodyText.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/);
    console.log('📅 Dátum:', dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : 'nem található');

    // Eredmény - keresünk nagy számokat
    const allText = await page.textContent('body') || '';
    const scoreMatch = allText.match(/(\d{2,3})\s*-\s*(\d{2,3})/);
    console.log('🔢 Eredmény:', scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : 'nem található');

    // Csapatnevek
    const teamLinks = await page.locator('a[href*="/csapat/"]').all();
    console.log('🏀 Csapatok:', teamLinks.length);
    for (let i = 0; i < Math.min(teamLinks.length, 2); i++) {
      const text = await teamLinks[i].textContent();
      console.log(`  ${i + 1}. csapat: ${text}`);
    }

    // Táblázatok
    const tables = await page.locator('table').filter({ has: page.locator('td') }).all();
    console.log('📊 Táblázatok száma:', tables.length);

    if (tables.length >= 1) {
      const firstTable = tables[0];
      const rows = await firstTable.locator('tbody tr').all();
      console.log('\n📋 Első táblázat (ASE) sorok:', rows.length);

      // Első játékos részletei
      if (rows.length > 0) {
        const firstRow = rows[0];
        const cells = await firstRow.locator('td').all();
        console.log('  Cellák száma:', cells.length);
        
        for (let i = 0; i < Math.min(cells.length, 10); i++) {
          const text = await cells[i].textContent();
          console.log(`  Cell ${i}: "${text}"`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Hiba:', error);
  } finally {
    await browser.close();
  }
}

testScrape();
