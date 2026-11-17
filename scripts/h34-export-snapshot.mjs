// H34 – Export MD összevetés: a SeasonComparison 7 exportját (2 játékos, csapat, 2 pre-game,
// 2 post-game) ugyanazzal a kattintássorral tölti le egy adott porton futó verzióból.
// A refaktor fázisai után a refaktor előtti `d1f5080` és az új verzió kimenetét kell
// bájtra összevetni – UGYANAKKOR futtatva, mert az adatbázis az importokkal változik.
//
// Lépések (a repó gyökeréből; a mappák a repón kívül legyenek):
//   1. git worktree add --detach /tmp/asestats-baseline d1f5080
//      cp -c -R node_modules /tmp/asestats-baseline/ && cp .env.local /tmp/asestats-baseline/
//      (cd /tmp/asestats-baseline && npx next build && npx next start -p 3101)
//   2. npx next build && npx next start -p 3102          # a vizsgált verzió
//   3. node scripts/h34-export-snapshot.mjs login 3102 /tmp/h34-state.json
//      – megnyílik egy böngésző, bejelentkezés után a munkamenet a fájlba kerül
//      (hozzáférési tokent tartalmaz: repón kívül tartandó, használat után törölhető)
//   4. node scripts/h34-export-snapshot.mjs export 3101 /tmp/h34-state.json /tmp/h34-base
//      node scripts/h34-export-snapshot.mjs export 3102 /tmp/h34-state.json /tmp/h34-new
//   5. diff -r /tmp/h34-base /tmp/h34-new                # üres kimenet = bájtra azonos
// Minden exportot kétszer tölt le kivárással; csak két azonos letöltést fogad el (az
// aszinkron Kosarstat / dobás betöltések miatt). A böngésző-konzol hibái: _console-errors.txt.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [mode, port, statePath, outDir] = process.argv.slice(2);
const base = `http://localhost:${port}`;

const SEASON = '2026/2027';
const TEAM = 'Atomerőmű SE';
const PLAYERS = ['CHANDLER III. John Watson', 'RÉVÉSZ Ádám'];
const OPPONENTS = ['DEAC', 'Alba'];
const GAMES = ['2026-11-14', '2026-11-11'];

const log = (...args) => console.log(`[${port}]`, ...args);

async function login() {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base);
    log('Jelentkezz be a megnyílt ablakban (max. 10 perc)…');
    await page.getByText('Elemzések', { exact: true }).first().waitFor({ timeout: 10 * 60 * 1000 });
    await page.waitForTimeout(1500);
    await context.storageState({ path: statePath });
    log('Munkamenet mentve:', statePath);
  } finally {
    await browser.close();
  }
}

// A storageState a mentés origin-jére szól; másik portra átírjuk.
function stateForPort() {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.origins = (state.origins || []).map(origin => ({ ...origin, origin: base }));
  state.cookies = (state.cookies || []).map(cookie => ({ ...cookie }));
  return state;
}

// A Szezon / Csapat / Játékos mező a „Játékos kiválasztása” kártyán belül (a fejlécben is van Szezon / Csapat).
const SCOPED_LABELS = new Set(['Szezon', 'Csapat', 'Játékos']);
const combobox = (page, label) => {
  const scope = SCOPED_LABELS.has(label)
    ? page.locator('div.rounded-lg, div[data-slot="card"]').filter({ hasText: 'Játékos kiválasztása' }).last()
    : page;
  return scope.locator(`div:has(> label:text-is("${label}"))`).getByRole('combobox').first();
};

async function choose(page, label, optionText) {
  const trigger = combobox(page, label);
  await trigger.waitFor({ timeout: 60000 });
  const current = (await trigger.textContent()) || '';
  if (current.includes(optionText)) return current.trim();
  await trigger.click();
  const option = page.getByRole('option').filter({ hasText: optionText }).first();
  await option.waitFor({ timeout: 30000 });
  const text = ((await option.textContent()) || '').trim();
  await option.click();
  await page.waitForTimeout(300);
  return text;
}

async function settle(page, ms = 4000) {
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(ms);
}

async function clickExport(page, fileName) {
  const button = page.getByRole('button', { name: 'Export MD' }).first();
  await button.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForFunction(el => !el.disabled, await button.elementHandle(), { timeout: 120000 });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), button.click()]);
  const target = path.join(outDir, fileName);
  await download.saveAs(target);
  return fs.readFileSync(target, 'utf8');
}

// Kétszer exportál, a második előtt újra kivár: ha eltér, az aszinkron betöltés még futott → újra.
async function stableExport(page, fileName) {
  let previous = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await settle(page, attempt === 1 ? 5000 : 6000);
    const md = await clickExport(page, fileName);
    if (previous !== null && md === previous) {
      log('  stabil:', fileName, `(${md.length} karakter, ${attempt}. kör)`);
      return;
    }
    previous = md;
  }
  throw new Error(`Nem stabil az export: ${fileName}`);
}

const slug = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function exportAll() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ storageState: stateForPort(), acceptDownloads: true, viewport: { width: 1600, height: 1200 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.getByText('Elemzések', { exact: true }).first().click({ timeout: 120000 });
    await settle(page);

    log('szezon:', await choose(page, 'Szezon', SEASON));
    log('csapat:', await choose(page, 'Csapat', TEAM));
    await settle(page);

    // Játékos
    for (const name of PLAYERS) {
      log('játékos:', await choose(page, 'Játékos', name));
      await page.getByRole('button', { name: 'Játékos', exact: true }).click();
      await stableExport(page, `jatekos-${slug(name)}.md`);
    }

    // Csapat
    await page.getByRole('button', { name: 'Csapat', exact: true }).click();
    await stableExport(page, 'csapat.md');

    // Pre-game
    await page.getByRole('button', { name: 'Pre-game', exact: true }).click();
    for (const opponent of OPPONENTS) {
      log('ellenfél:', await choose(page, 'Ellenfél', opponent));
      await stableExport(page, `pregame-${slug(opponent)}.md`);
    }

    // Post-game
    await page.getByRole('button', { name: 'Post-game', exact: true }).click();
    for (const date of GAMES) {
      log('meccs:', await choose(page, 'Mérkőzés', date));
      await stableExport(page, `postgame-${date}.md`);
    }
  } finally {
    fs.writeFileSync(path.join(outDir, '_console-errors.txt'), errors.join('\n') + '\n');
    await browser.close();
  }
  log('kész:', outDir, `(konzolhiba: ${errors.length})`);
}

(mode === 'login' ? login() : exportAll()).catch(error => {
  console.error(error);
  process.exit(1);
});
