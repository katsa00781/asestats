import { chromium } from 'playwright';

const gameId = '20250926163101';
const urls = [
  `https://kosarstat.hu/games/game/game_qrts/?game=${gameId}`,
  `https://kosarstat.hu/games/game/clutch_stat/?game=${gameId}`,
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);

    const tables = await page.$$eval('table', all =>
      all.map((t, i) => {
        const headers = Array.from(t.querySelectorAll('thead th'))
          .map(x => (x.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        const rows = Array.from(t.querySelectorAll('tbody tr'))
          .slice(0, 4)
          .map(r =>
            Array.from(r.querySelectorAll('td,th')).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim())
          );
        return { i, id: t.getAttribute('id'), className: t.getAttribute('class'), headers, rows };
      })
    );

    console.log(`\nURL: ${url}`);
    console.log(`table count: ${tables.length}`);
    for (const t of tables) {
      console.log(`- idx=${t.i} id=${t.id || ''} class=${t.className || ''}`);
      console.log(`  headers=${JSON.stringify(t.headers).slice(0, 260)}`);
      for (const row of t.rows) {
        console.log(`  row=${JSON.stringify(row).slice(0, 260)}`);
      }
    }
  }

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
