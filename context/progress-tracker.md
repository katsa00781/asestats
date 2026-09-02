# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Aktív fejlesztés – meglévő funkcionalitás optimalizálása és bővítése

## Current Goal

- **Mobil (iOS) Expo alkalmazás** – az S1 tervdokumentáció elkészült (`context/mobile/`); következő lépés az S2 vizuális validáció (felhasználói lépés), majd az S3 Expo váz

## Completed

- Next.js 16 + React 19 + TypeScript 5 alap projekt beállítva
- Supabase integráció: kliens, auth, teljes Database típus definíció (`lib/supabase.ts`)
- Supabase Auth: AuthProvider context, bejelentkezés/kijelentkezés (LoginForm)
- Adatbázis séma: games, players, player_game_stats, seasons, teams, league_fixtures, standings, play_by_play_events, shotchart_events, game_text_reports táblák
- `player_season_stats_by_season` view aggregált statisztikákhoz
- Hunbasket.hu scraping: teljes szezon, roster, fixtures, shot chart, play-by-play (Playwright)
- Kosarstat.hu scraping: play-by-play import
- Főoldal dashboard szezon/csapat szűrőkkel
- Tab rendszer: Áttekintés, Játékosok, Elemzések, Tabella, Meccsek, Meccs Log, Szituációk, Frissítések, Kezelés, Játékos Import, Törlés, Import
- TeamStatistics komponens csapatszintű átlagokkal
- PlayersList és PlayerDetails komponensek fejlett metrikákkal (TS%, EFG%, OrtG, DrtG, VAL)
- PlayerComparison, TeamComparison, SeasonComparison összehasonlítók
- GamesList közelgő meccsekkel (league_fixtures)
- GameLog meccs előzmények
- SituationalAnalysis szituációs elemzés
- StandingsView + StandingsImport tabella
- Import komponensek: KosarstatPbpImport, FixturesImport, RosterImport, RoundImport, GameQuickImport, JsonImport
- PlayersManagement, GameManagement admin felületek
- PostgameShotScatterChart, PostgameZoneHeatmapChart vizualizációk
- Pregame scouting és postgame riport logika (`lib/pregame-scouting.ts`, `lib/postgame-report.ts`)
- Szezontámogatás migrációk (múlt szezonok, `season_id` a games/players táblákban)
- Csapattámogatás migrációk (teams tábla, `team_id` a games/players táblákban)
- Ellenfél meccsek lekérdezése és opponentGameId mapping
- Duplikált játékosok javítása (több SQL migráció)
- Kosarstat PBP page metadata backfill

## In Progress

- **Mobil (iOS) Expo alkalmazás – S1 tervdokumentáció ✓ (2026-08-30)**. Négy új context fájl a `context/mobile/` alatt: `mobile-overview.md` (scope + iOS információs architektúra), `mobile-architecture.md` (repo alak + megosztott mag + adatréteg), `mobile-ui-context.md` (design token híd), `mobile-design-prompts.md` (15 vizuális design prompt). **Nincs kódváltozás** – a webes app érintetlen. Következő: S2 vizuális validáció (felhasználói lépés a design eszközben), majd S3 Expo váz.
- **`context/ui-context.md` teljes újraírása ✓ (2026-08-30)** – a fájl elavult volt (Geist fontok, OKLCH shadcn változók, `--radius: 0.625rem`, megszűnt `container mx-auto` header minta). Az új verzió soronként a `globals.css`-ből ellenőrizve dokumentálja a teljes design rendszert, plusz egy „Ami NEM létezik" szakaszt a gyakori félreértésekről.
- **`CLAUDE.md` javítása ✓ (2026-09-01)** – hat eltérés a valós kódhoz igazítva: 2 szín-token (`--text-secondary`, `--text-muted`), a nemlétező `tailwind.config.ts` és a `3xl`/`4xl` breakpointok, a `.card` osztályt és tiltott `as any`-t használó animációs példa, a téves `requireAuth()` állítás (valójában mind a 14 route `requireAdmin`-t futtat, a `requireAuth` holt kód), és 2 hiányzó API route a fastruktúrában.
- (A javítási sprint kódmunkája kész; a 3 migráció kézi futtatására és a GitHub Actions secretek beállítására vár – lásd „Manuális teendők")

## Manuális teendők (a sprint lezárásához)

1. **Supabase SQL Editorban futtatandó (ebben a sorrendben!):**
   - `migrations/add-player-game-stats-2026-2027.sql` (2026/27 szezon tábla – a többi migráció hivatkozik rá; 2026-07-18-án javítva: érvénytelen `ADD CONSTRAINT IF NOT EXISTS` szintaxis → DO blokk, policy-k idempotensek)
   - `migrations/add-games-unique-constraint.sql` (games dedup + unique index)
   - `migrations/add-players-unique-index.sql` (players dedup + unique index)
   - `migrations/fix-season-view-games-played.sql` (view: DNP + átigazolás fix – felülírja az előző lépésben létrejött view-definíciót, ez szándékos)
   - A fájlok végén ellenőrző SELECT-ek vannak.
2. **FONTOS**: a games-írók (scraper, GameQuickImport) már `onConflict: 'season_id,our_team_id,date'` upsertet használnak – az első migráció futtatásáig az importok hibát dobnak (szándékos: kikényszeríti a migrációt).
3. **GitHub Actions**: repo Settings → Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; utána a `scrape.yml` workflow_dispatch-csel tesztelhető.
4. **Egyszeri backfill**: `npm run kosarstat:backfill-links` – a meglévő kosarstat meccsek games-linkjeinek pótlása.

## Completed (legutóbbi)

- **Javítási sprint Fázis 2–5** (2026-07-18):
  - **Adat-dedup**: 3 új migráció (games unique, players unique, szezon-view fix); mindhárom games-író közös kulcsra upsertel; JsonImport `.single()` hibája javítva; kosarstat scraper írja a `games.kosarstat_game_id`-t (+ backfill script); ensureTeam névdrift-védelem (`HUNBASKET_ALLOW_NEW_TEAMS=1` kapcsoló)
  - **Kód-dedup**: `lib/supabase-admin.ts` (9 route admin-bootstrapje), `lib/player-stat-mapping.ts` (a 2 hook 85 soros duplikált mappingje – a useFilterData hibás TS/eFG súlyozása is javítva: összegzett dobásokból számol), `lib/stat-formulas.ts` (TS%/eFG%/VAL 6 másolat helyett + egységes formatPercent 1 tizedessel), `scrape-utils.ts` (4× duplikált normalizeName/findTeamInCache/kliens-bootstrap), `lib/run-script.ts` (spawn wrapper 3 route-ból)
  - **Auth**: `lib/api-auth.ts` requireAuth guard mind a 14 API route-on; `lib/api-fetch.ts` authFetch a 23 kliens-hívási helyen; kijelentkezve minden import/cleanup/generate endpoint 401-et ad
  - **Automatizálás**: `.github/workflows/scrape.yml` – hétvége esti cron + workflow_dispatch, a CLI szkripteket futtatja (fixtures → standings → import → kosarstat:pbp)
  - **npm scriptek**: deprecated `hunbasket:pbp` stub archive-ba; új `hunbasket:standings` és `kosarstat:backfill-links`
  - **Dokumentáció**: CLAUDE.md (valós táblanevek, lib lista, scraping/auth/automatizálás), context/architecture.md (dedup kulcsok, koordináta-konvenció, auth, új invariánsok), BACKLOG.md
  - Verifikáció minden unit után: `npm run build` + `tsc --noEmit` + `lint` zöld (7 korábbról meglévő lint warning, 0 error)

- **Javítási sprint Fázis 1 – statisztikát torzító hibák** (2026-07-18):
  - `lib/fetch-all-rows.ts`: lapozó helper a PostgREST 1000 soros limit ellen
  - `hooks/useFilterData.ts`: minden nagy lekérdezés lapozva + determinisztikus rendezés (a PlayerComparison liga-átlagai eddig 1000 sorra csonkolt adatból számolódtak)
  - `components/SeasonComparison.tsx`: 6 shot-event lekérdezés lapozva; fordított corner-3 zóna-besorolás javítva; koordináta-konvenció dokumentálva (kosár x≈6, 0–100 skála)
  - `components/PostgameShotScatterChart.tsx`: pályán kívüli dobások clampelve az eldobás helyett
  - `components/PlayersList.tsx`: forma-sparkline a legutóbbi 5 meccs (volt: legrégebbi 5), időrendi sorrendben
  - `lib/situational-analysis.ts`: eFG hazai/vendég split szűrés-konzisztencia; `lib/team-analysis.ts`: netRtg guard birtoklás-alapú
  - Verifikáció: `npm run build` + `tsc --noEmit` + `lint` zöld (7 korábbról meglévő lint warning, 0 error)

- **MD export szekció felülre mozgatva** (2026-05-24):
  - `components/GameDetails.tsx`: AI riportok + Manuális elemzés beillesztése → fejléc alá, statisztikák elé
  - `components/PlayerDetails.tsx`: Manuális szezonértékelés beillesztése → játékos kártya alá, statisztikák elé
  - `components/TeamStatistics.tsx`: Manuális csapatelemzés beillesztése → cím alá, KPI kártyák elé

- **MD export + manuális elemzés mentése** (2026-05-22):
  - `lib/export-to-md.ts`: `gameStatsToMd`, `playerSeasonToMd`, `teamStatsToMd` – MD generálás statokból
  - `migrations/add-manual-report-type.sql`: 'manual' report_type hozzáadva – **kézzel kell futtatni Supabase SQL Editorban**
  - `app/api/save-manual-report/route.ts`: manuális riport mentése 3 táblába (game_text_reports, team_text_reports, player_text_reports)
  - `lib/supabase.ts`: 'manual' hozzáadva a game_text_reports és team_text_reports report_type union típushoz
  - `components/GameDetails.tsx`: "Export MD" gomb (letölt + vágólapra másol) + paste-and-save textarea
  - `components/PlayerDetails.tsx`: "Export MD" gomb + paste-and-save textarea szezonértékeléshez
  - `components/TeamStatistics.tsx`: 'use client' hozzáadva, új props (seasonId, teamId, seasonName), "Export MD" gomb + paste-and-save textarea
  - `app/page.tsx`: seasonId, teamId, seasonName props átadva TeamStatistics-nak

### Korábbi

- **Per-játékos AI értékelések a GameDetails-ban + DB perzisztencia** (2026-05-22):
  - Migráció: `migrations/add-player-game-text-reports.sql` – kézzel futtatandó Supabase SQL Editorban
  - `lib/supabase.ts`: `player_game_text_reports` tábla típus hozzáadva
  - `app/api/generate-player-postgame-text/route.ts`: upsert `player_game_text_reports`-ba (service role)
  - `components/GameDetails.tsx`: mountkor betölti a meglévő értékeléseket; "Újragenerálás" felirat ha már van adat
  - Breakdown JSON is tárolódik – megnyitáskor azonnal megjelennek a badge-ek és szövegek

- **player_game_stats szezonos szétválasztás** (2026-05-21):
  - Létrehozva: `player_game_stats_2023_2024`, `player_game_stats_2024_2025`, `player_game_stats_2025_2026` táblák
  - Migráció SQL: `migrations/split-player-game-stats-by-season.sql` (Supabase SQL Editorban futtatandó)
  - Visszafelé kompatibilis UNION view `player_game_stats` névvel + INSTEAD OF trigger routing
  - Új helper: `lib/season-tables.ts` (táblanév mapping, `getSeasonStatsTable`, `ALL_SEASON_STATS_TABLES`)
  - `app/page.tsx`: szűretlen cross-season lekérdezés → szezonspecifikus táblákra bontva (1000 soros limit elkerülése)
  - `player_season_stats_by_season` view újraírva, közvetlenül a szezon-specifikus táblákból aggregál

## Next Up

- **S2 – Mobil vizuális validáció** (felhasználói lépés): a `mobile-design-prompts.md` P0 promptja, majd P2 és P8 lefuttatása a választott design eszközben. Ha a design nyelv nem áll össze, a `mobile-ui-context.md` módosul, és csak utána megy a maradék 11 prompt.
- **S3 – Expo váz**: `mobile/` létrehozása. **Első feladat egy `@core/stat-formulas` import füstteszt** a szimulátorban – ha a Metro alias nem működik, a fallback az npm workspace-re promotálás. Ezt az első órában kell tudni, nem a tizedik képernyőnél.
- **Új npm csomagok jóváhagyása S3 előtt**, pontos verziókkal (expo, expo-router, nativewind, victory-native, react-native-skia, async-storage, url-polyfill, safe-area-context, reanimated, gesture-handler, lucide-react-native).

## Open Questions

- Szükséges-e a `game_text_reports` tábla UI-ban is megjeleníteni (pregame/postgame riport megtekintő)?
- Tervezett-e role-alapú hozzáférés-vezérlés (admin vs. olvasó felhasználók)?
- A `fouls_drawn` mező miért 0 mindig? (az `app/page.tsx` kommentje: "Nincs a view-ban") – szükséges-e hozzáadni a view-hoz?
- Az `offensiveRating` és `defensiveRating` a `PlayerStats` típusban kiszámolt értékek (scoring efficiency / defensive index), nem az NBA-féle metrikák – dokumentálni kellene a definíciót
- Szükséges-e az alkalmazásban megjeleníteni a Eurobasket.com játékos fotókat? (nextConfig-ban engedélyezve, de komponensben nincs használva)

## Architecture Decisions

- **Supabase view használata aggregált statisztikákhoz** (`player_season_stats_by_season`): elkerüli a komplex aggregáció kliens oldali elvégzését; migrációs fájlban frissítendő, ha új statisztikai mező kerül a rendszerbe
- **`app/page.tsx` monolitikus megközelítés**: az összes fő state és adatlekérés egy helyen van, mert az alkalmazás egyoldalas dashboard; ha tovább bővül, érdemes lehet Context-be vagy Zustand-ba kiszervezni
- **Két chart könyvtár egymás mellett** (Chart.js és Recharts): Chart.js a shot chart vizualizációhoz (canvas-alapú, flexibilisebb), Recharts az összehasonlítókhoz és trendekhez (deklaratív React komponensek)
- **Scraping CLI és API route kettősség**: az npm szkriptek CLI-ből futnak produkciós adatfrissítéshez, az API route-ok az in-app import gombokhoz; ugyanaz a logika, különböző belépési pontok
- **`dynamic = 'force-dynamic'` minden import API route-on**: a Vercel edge caching megakadályozná az adatfrissítést; minden ilyen route mindig friss adatot kér
- **Magyar terminológia a UI-ban**: az alkalmazás célközönsége magyar edzői stáb; minden label, üzenet és komment magyarul
- **Mobil: külön Expo alkalmazás, nem reszponzív web** (2026-08-30): a webes mobilkezelés egyetlen media query, ami csak a navigációt oldja meg – a DataTable (`white-space: nowrap`), a StatCard (fix `text-[2.5rem]` + `min-h-35`) és az 5 prefixeletlen `grid-cols-3/4` érdemi újratervezést igényelne. Ha úgyis újratervezzük, natív platformon tesszük.
- **Mobil: izolált `mobile/` mappa, npm workspace nélkül** (2026-08-30): a workspace root átalakítása hoisting-ütközést hozna a web React 19 és az Expo pinnelt React-je között, és 30+ fájl mozgatását igényelné a működő webes appban. Az izolált forma nulla webes változtatást igényel és azonnal visszavonható; a megosztás Metro `extraNodeModules` `@core` aliasszal megy a gyökér `lib/`-re. Promotálható valódi workspace-re, ha a megosztás a UI-ra is kiterjed.
- **Mobil: a `lib/` elemző mag megosztott, a `components/` nem** (2026-08-30): import-audit igazolta, hogy 15 modul (~9 500 sor) nulla külső importot tartalmaz – se React, se Next, se DOM, se Supabase. A 31 583 sornyi `components/` viszont teljes RN újraírás.

## Session Notes

- A kontextus fájlok 2026-05-11-én készültek el a meglévő CLAUDE.md és projekt vizsgálata alapján
- A projekt repository: <https://github.com/katsa00781/asestats> (privát)
- Folytatáshoz: olvasd el az összes kontextus fájlt sorban, majd kérdezd meg a felhasználót, mi a következő fejlesztési egység
