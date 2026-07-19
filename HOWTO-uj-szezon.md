# HOWTO: Új szezon hozzáadása

Minden bajnoki szezon előtt/elején el kell végezni az alábbi lépéseket. A folyamat egy nagy SQL migrációból és egy apró kód-ellenőrzésből áll.

**A 2026/2027 szezonra ez már elkészült**: `migrations/add-player-game-stats-2026-2027.sql` és a `lib/season-tables.ts` mapping létezik – csak a migráció futtatása és a szezonkezdési checklist van hátra (lásd alul).

---

## 1. SQL migráció – egy fájl, minden lépés

Egy új szezon SQL-oldali bevezetése **egyetlen migrációs fájlban** történik (ld. `migrations/add-player-game-stats-2026-2027.sql` mintaként), mert a `player_game_stats` UNION view és a hozzá tartozó INSTEAD OF triggerek minden szezontáblát ismerniük kell újradefiniáláskor. A fájl az alábbi 7 lépést tartalmazza, egymás után, egy futtatásban:

1. **Új szezonspecifikus tábla** – `CREATE TABLE IF NOT EXISTS player_game_stats_YYYY_YYYY (LIKE player_game_stats_<előző_szezon> INCLUDING ALL)`, majd az FK-k (`fk_game`, `fk_player`) explicit újralétrehozása `DO $$ ... $$` guard mögött (a `LIKE` nem örökli az FK-kat), és a két index (`game_id`, `player_id`).
2. **RLS** – `ENABLE ROW LEVEL SECURITY` + SELECT/INSERT/UPDATE/DELETE policyk az új táblára, `GRANT` `anon`/`authenticated`-nek. (Ha az `extend-rbac-standings-teams.sql`/`add-rbac-rls.sql` admin-only RLS már be van vezetve, ez a lépés is admin-only policykra frissítendő – lásd 2. lábjegyzet alul.)
3. **`player_game_stats` UNION view újradefiniálása** – `CREATE OR REPLACE VIEW`, hozzáadva az új `UNION ALL SELECT * FROM player_game_stats_YYYY_YYYY` ágat.
4. **3 INSTEAD OF trigger újradefiniálása** (`route_pgs_insert`, `route_pgs_update`, `route_pgs_delete`) – ezek a view-ra írt INSERT/UPDATE/DELETE-et irányítják a megfelelő szezontáblára `season_id` alapján; az új szezon `season_id`-ját is fel kell venni az elágazásba.
5. **`player_season_stats_by_season` + `player_season_stats` view-k újradefiniálása** – az aggregált szezon-statisztika view-k, amik minden szezontáblát UNION-olnak.
6. **Új sor a `seasons` táblában** – `INSERT ... ON CONFLICT (name) DO NOTHING`, **`is_current = false`** (lásd a szezonkezdési checklistet alul, mielőtt igazra állítanád).
7. **Ellenőrző SELECT** a `seasons` táblából.

**Futtasd le teljes egészében** a Supabase SQL Editorban – a fájl idempotens (`IF NOT EXISTS`/`DROP POLICY IF EXISTS`/`ON CONFLICT` mintákkal), újrafuttatható hiba esetén.

> **FONTOS**: amíg a migráció nincs lefuttatva, de a `lib/season-tables.ts` mapping már tartalmazza az új szezont, a `hooks/useFilterData.ts` minden `ALL_SEASON_STATS_TABLES` táblát lekérdez – ha egy tábla hiányzik, a szűrő-betöltés hibázik. A kód-lépés (2. pont) csak a migráció UTÁN kerüljön be, vagy a migrációt azonnal futtasd le a kód-módosítással egy időben.

---

## 2. `lib/season-tables.ts` – mapping bővítése

```ts
export const SEASON_STATS_TABLES: Record<string, string> = {
  '2023/2024': 'player_game_stats_2023_2024',
  '2024/2025': 'player_game_stats_2024_2025',
  '2025/2026': 'player_game_stats_2025_2026',
  '2026/2027': 'player_game_stats_2026_2027',  // ← új sor
} as const;
```

Az `ALL_SEASON_STATS_TABLES` és a `getSeasonStatsTable()` automatikusan a bővített mappingből dolgozik – nincs más kód-hely, amit módosítani kellene (a `getSeasonStatsTable()`-t mindenhol hívni kell, sehol nem szabad új hardcoded táblanevet írni – lásd a `components/Updates.tsx` 2026-07-19-es javítását, ahol egy hardcoded `player_game_stats_2025_2026` hivatkozás lecserélődött erre a mintára).

---

## 3. RBAC – ha az admin-only írásvédelem már be van vezetve

Ha a `migrations/add-rbac-rls.sql` már le van futtatva (admin-only INSERT/UPDATE/DELETE a szezontáblákon), az 1. lépés RLS-policyi helyett ugyanezt az admin-only mintát kell alkalmazni az új szezontáblára is – az `add-rbac-rls.sql` fájl már tartalmaz egy `DO $$ IF EXISTS (... 'player_game_stats_2026_2027') ... $$` blokkot erre, ami újrafuttatható, ha az új tábla már létezik.

---

## 4. Szezonkezdési checklist (amikor a bajnokság ténylegesen elindul)

- [ ] `UPDATE seasons SET is_current = false WHERE name = '<előző szezon>';`
- [ ] `UPDATE seasons SET is_current = true WHERE name = '<új szezon>';`
- [ ] GitHub Actions repo variables átállítása: `HUNBASKET_SEASON_SLUG`, `HUNBASKET_SEASON_NAME`, `KOSARSTAT_SEASON_NAME` (`.github/workflows/scrape.yml`)
- [ ] Első kör import: `npm run hunbasket:fixtures`, majd `npm run hunbasket:import`

---

## 5. Ellenőrzés

- Indítsd el a dev szervert: `npm run dev`
- Nyisd meg a dashboardot, válaszd ki az új szezont a SeasonSelector-ban
- Ellenőrizd, hogy a nézetek helyesen töltődnek be (üres lista az elvárt – még nincsenek meccsek)
- Futtasd az első kör importját: `npm run hunbasket:import`

---

## Összefoglaló checklist – új szezon SQL-előkészítése

- [ ] SQL migráció (`migrations/add-player-game-stats-YYYY-YYYY.sql`) megírva és lefuttatva: tábla + RLS + UNION view + 3 trigger + aggregált view-k + `seasons` sor (`is_current=false`)
- [ ] Kód: `lib/season-tables.ts` bővítve
- [ ] Teszt: dev szerver és SeasonSelector ellenőrzés (üres, de hibamentes nézetek)
- [ ] Amikor a szezon ténylegesen indul: lásd a fenti "Szezonkezdési checklist"-et
