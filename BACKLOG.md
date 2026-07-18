# BACKLOG.md – ASEStats Projekt

_Utoljára frissítve: 2026-07-18 (Javítási sprint Fázis 1 – statisztikát torzító hibák javítva)_

---

## Aktív sprint – Javítási terv (2026-07-18)

Teljes kódbázis-audit alapján futó sprint: duplikációk megszüntetése, import ellenőrzés + automatizálás, elemzési algoritmusok javítása. Részletes terv a session plan fájlban.

- [x] **Fázis 1 – Statisztikát torzító hibák** (2026-07-18):
  - `lib/fetch-all-rows.ts` új lapozó helper a PostgREST 1000 soros limit ellen
  - `hooks/useFilterData.ts`: view + players + szezon-táblák lapozva (PlayerComparison liga-átlagok eddig csonkolt adatból számolódtak)
  - `components/SeasonComparison.tsx`: 6 shot-event lekérdezés lapozva (liga/csapat/ellenfél/játékos szezon-dobások)
  - `components/SeasonComparison.tsx` `classifyShotZone`: fordított corner-3 feltétel javítva (`x >= 25` → `x <= 14`; a kosár x≈6-nál van)
  - `components/PostgameShotScatterChart.tsx`: kieső dobások néma eldobása helyett pálya-szélre szorítás (clamp)
  - `components/PlayersList.tsx`: forma-sparkline a legutóbbi 5 meccset mutatja (eddig a legrégebbit), időrendben
  - `lib/situational-analysis.ts`: hazai/vendég eFG split azonos szűréssel, mint az összesített
  - `lib/team-analysis.ts`: netRtg birtoklás-alapú guard (legitim 0 rating nem nullázza)
  - `SeasonComparison.computeTotalValuation`: dokumentálva, hogy csak fallback (a tárolt VAL az elsődleges; fouls_drawn adathiány miatt a formula szándékosan egyszerűsített)
- [x] **Fázis 2 – Adat-dedup védelem** (2026-07-18):
  - `migrations/add-games-unique-constraint.sql` – games dedup + UNIQUE (season_id, our_team_id, date) – **KÉZZEL FUTTATANDÓ Supabase SQL Editorban!**
  - `migrations/fix-season-view-games-played.sql` – view: DNP kiszűrés games_played-ből, csapat a meccsből (átigazolás-fix), is_active szűrő elhagyva – **KÉZZEL FUTTATANDÓ!**
  - `migrations/add-players-unique-index.sql` – players merge + partial unique index (season_id, team_id, lower(name)) – **KÉZZEL FUTTATANDÓ!**
  - 3 games-író egységesítve upsertre (scrape-hunbasket, GameQuickImport, JsonImport – utóbbi `.single()` bugja is javítva)
  - Kosarstat scraper mostantól írja a games.kosarstat_game_id linkeket + `scripts/backfill-kosarstat-game-links.ts` a régi adatokra
  - ensureTeam: névdrift-védelem (új csapat csak HUNBASKET_ALLOW_NEW_TEAMS=1 mellett)
- [x] **Fázis 3 – Kód-dedup** (2026-07-18): `lib/supabase-admin.ts` (9 route), `lib/player-stat-mapping.ts` (2 hook), `lib/stat-formulas.ts` (6 formula-másolat helyett; useFilterData TS/eFG súlyozási hibája is javítva), `scrape-utils.ts` (5 szkript), `lib/run-script.ts` (3 route)
- [x] **Fázis 4 – Import auth + automatizálás** (2026-07-18): `lib/api-auth.ts` requireAuth guard mind a 14 API route-on + `lib/api-fetch.ts` authFetch a kliensen (23 hívási hely); npm scriptek rendezve (deprecated hunbasket:pbp törölve, hunbasket:standings + kosarstat:backfill-links felvéve); `.github/workflows/scrape.yml` ütemezett import (secretek beállítása szükséges!)
- [x] **Fázis 5 – Dokumentáció-szinkron** (2026-07-18): CLAUDE.md táblanevek + lib lista + scraping szekció; architecture.md storage/auth/invariánsok
- [ ] **(Backlogra tolva) SeasonComparison 18k soros monolit szétbontása** – típusok → lib parsing → hook → tab-komponensek, a `lib/kosarstat-clutch-parse.ts` kiemelés mintájára
- [ ] **(Backlogra tolva) Közvetlen Supabase query-k hookba szervezése** – 26 fájl kerüli meg a hookokat (seasons 6, teams 7 helyen)

---

## Jelenlegi állapot

### Implementált funkciók (kódból látható)

**Auth és navigáció**

- Supabase email/jelszó alapú bejelentkezés, `AuthProvider` context
- Auth guard a főoldalon – bejelentkezés nélkül csak `LoginForm` látható
- Szezon és csapat szűrő (SeasonSelector, TeamSelector) az összes nézet felett

**Design rendszer – Dark Command Center (új)**

- `app/globals.css` Single Source of Truth: nyers tokenek (`:root`) + Tailwind 4 `@theme inline` blokk
- 3 fontcsalád szerepspecifikus betöltéssel (`next/font/google`): Barlow Condensed (display), DM Sans (body), JetBrains Mono (stat)
- shadcn/ui override-ok: Card, Button, Badge, Input, Select, Tabs azonnal Dark Command Center palettát kapnak
- Glow, scan, blink, pulse-glow, count-up, fade-slide-up, skeleton-shimmer animáció utility-k
- Pont-rács háttér + 2 nagy radial telemetria glow folt a `body`-n
- Egyedi utility-k: `.ai-marker`, `.live-dot`, `.bar-track`/`.bar-fill`, `.hairline`, `.grid-overlay`, `.dot-overlay`, `.stagger`
- `tailwind.config.ts` CSS-first módban – színt és fontot nem definiál, csak `content` scant és `3xl/4xl` breakpointokat

**Dashboard tab-ok (12 db)**

- **Áttekintés** – csapatszintű átlagok (pontok, lepattanó, gólpassz, steal, blokk, turnover, valuation); csapat összehasonlítás gomb
- **Játékosok** – aggregált szezon statisztikák listája (TS%, EFG%, OrtG, DrtG, VAL); játékos részletes nézet gameHistory-val, trendekkel; játékos összehasonlítás
- **Elemzések** – SeasonComparison: csapat- és játékosstatisztikák szezonon keresztül
- **Tabella** – StandingsView megjelenítő + StandingsImport kézi szövegből
- **Meccsek** – GamesList lejátszott meccsek eredményekkel + közelgő fixtures (league_fixtures)
- **Meccs Log** – GameLog: összes meccs részletes bontása játékosonként
- **Szituációk** – SituationalAnalysis: hazai/vendég, nyert/veszített bontás
- **Frissítések** – Updates komponens
- **Kezelés** – PlayersManagement: játékos hozzáadás/szerkesztés/törlés
- **Játékos Import** – PlayersImport: tömeges játékos létrehozás
- **Törlés** – GameManagement: meccsek törlése szezon/csapat szűréssel
- **Import** – KosarstatPbpImport, FixturesImport, RosterImport, RoundImport, GameQuickImport, JsonImport

**AI szöveg generálás (OpenAI gpt-4.1-mini / Anthropic Claude)**

- Pregame scouting riport (`/api/generate-pregame-text`)
- Postgame meccs elemzés (`/api/generate-game-text-report`)
- Játékos postgame szöveg (`/api/generate-player-postgame-text`)
- Játékos szezonelemzés (`/api/generate-player-season-text`)
- Csapat szezon elemzés (`/api/generate-team-analysis-text`)
- Riport mentés/lekérés Supabase-be (`/api/game-text-report`, `/api/player-text-report`)
- Riport megtekintő UI a `GameDetails.tsx`-ben
- MD export + manuális elemzés mentése (`lib/export-to-md.ts`, `/api/save-manual-report`)

**Scraping CLI szkriptek**

- Hunbasket.hu: teljes szezon, roster, fixtures, shot chart, play-by-play (Playwright)
- Kosarstat.hu: play-by-play import
- Eurobasket.com: játékos adat import API route-on keresztül

**Vizualizáció**

- Shot scatter chart (Chart.js, `PostgameShotScatterChart`)
- Zóna heatmap (Chart.js, `PostgameZoneHeatmapChart`)
- Trend chartok (Recharts, `PlayerTrends`)

**Adatbázis**

- Teljes adatbázis séma: games, players, seasons, teams, league_fixtures, standings, play_by_play_events, shotchart_events, game_text_reports, team_text_reports
- Szezonspecifikus táblák: `player_game_stats_2023_2024`, `player_game_stats_2024_2025`, `player_game_stats_2025_2026`
- UNION view + INSTEAD OF trigger visszafelé kompatibilitáshoz
- `player_season_stats_by_season` aggregált view
- `lib/season-tables.ts` – táblanév mapping, PostgREST 1000 soros limit megkerülése
- RLS engedélyezve a `game_text_reports` és `team_text_reports` táblákon

**Kódbázis higiénia**

- `app/page.tsx` ~1090 → ~250 sor: adatlekérés kiszervezve `hooks/useGameData.ts` és `hooks/useFilterData.ts`-be, publikus típusok `lib/dashboard-types.ts`-be
- 64 egyszeri diagnosztikai fájl (`fix-*.sql`, `check-*.sql`, `delete-*.sql`, `test-*.js`) áthelyezve `archive/` mappába
- `HOWTO-uj-szezon.md` – új szezon hozzáadásának lépéssora

### Oldalak / route-ok

- `/` – egyoldalas dashboard (tab-alapú navigáció, 12 nézet)
- `/api/eurobasket-player-import` – POST
- `/api/game-text-report` – GET/POST
- `/api/generate-game-text-report` – POST
- `/api/generate-player-postgame-text` – POST
- `/api/generate-player-season-text` – POST
- `/api/generate-pregame-text` – POST
- `/api/generate-team-analysis-text` – POST
- `/api/hunbasket-fixtures-import` – POST
- `/api/hunbasket-roster-import` – POST
- `/api/hunbasket-round-import` – POST
- `/api/kosarstat-pbp-cleanup` – POST
- `/api/kosarstat-pbp-import` – POST
- `/api/player-text-report` – GET/POST
- `/api/save-manual-report` – POST

---

## Lezárt sprint – Dark Command Center stílus átállás ✓ (2026-05-24)

**Scope: kizárólag vizuális stílus.** A komponensek funkcionalitása, a 12 tab-os navigáció, az adatlekérés és az interakciós flow változatlan marad. Minden feladat teljesítve.

A design rendszer alapja kész (`app/globals.css`, `app/layout.tsx`). Közös chart theme: `lib/chart-theme.ts`.

- [x] **`components/ui/stat-card.tsx` létrehozása** – Generikus KPI kártya a `StatCard.html` mockup szerint: `label`, `value`, `trend` (up/down/neutral), `trendValue`, `icon`, `accentColor` (cyan/orange/green/purple), `animationDelay` props. A `value` JetBrains Mono `tabular-nums`. Belépéskor `animate-fade-slide-up` + `animate-count-up`. _Függőség: nincs._

- [x] **`components/ui/data-table.tsx` létrehozása** – Generikus típusos tábla: `ColumnDef<T>` (key, label, numeric, center, sortable, sortAccessor, width, render), saját sort state, `activeRowId` támogatás, `footer` slot. CSS osztályok: `dt-shell`, `dt-th`, `dt-num`, `dt-num--muted`, `dt-sort-icon`. A `DataTable.html` mockup szerint. _Függőség: nincs._

- [x] **`shadcn/ui` data-slot audit** – Badge, Tabs, Card, Button, Input, Select – mind rendelkezik a szükséges `data-slot` attribútumokkal. A `globals.css` szelektorok matchelnek. `npx shadcn add` újrafuttatás nem szükséges. _Függőség: nincs._

- [x] **Tab navigáció vizuális frissítése** – `page.tsx` Dark Command Center tokenekre állítva: header (`bg-surface-1`, border, `shadow-panel`), h1 (`font-display`, `text-cyan` Trophy ikon), label-ek (`uppercase-label`), mobil csoportgombok (surface/cyan tokenek), error state-ek (`text-negative`), loading (`text-secondary`), "Csapatok összehasonlítása" gomb (`variant="secondary"`), Törlés tab (`text-negative`). `TAB_TRIGGER_CLASS` tisztítva (font/szín a `globals.css` kezeli). _Függőség: shadcn audit._

- [x] **`PlayersList.tsx` átállítása DataTable-re** – Kártyagrid helyett `<DataTable<PlayerRow>>`: #, Név (dt-player+avatar+meta), Poz. (dt-badge pozíció szerint), M, PPG/RPG/APG/FG%/TS%/eFG% (data-stat mono), Pont hat. (orange), Véd. idx (cyan), VAL (ai), Forma (SVG sparkline, last 5 meccs). Initial sort: VAL desc. _Függőség: DataTable._

- [x] **`StandingsView.tsx` átállítása DataTable-re** – Card+Select+loading state megmarad; belső `<table>` helyett `<DataTable<StandingRow>>` 14 oszloppal. Position badge (dt-badge--win/sf/neutral), GY/V színezett (pos/neg), +/- colored diff, SOR dt-trend ikonnal. Footer jelmagyarázat dt-badge példányokkal. _Függőség: DataTable._

- [x] **`GameLog.tsx` átállítása DataTable-re** – A meccsenkénti játékos breakdown is DataTable-be. _Függőség: DataTable._

- [x] **`TeamStatistics.tsx` StatCard-ra állítás** – A csapatszintű átlagok (pontok, lepattanó, gólpassz, steal, blokk, turnover, valuation) StatCard kártyákban, `accentColor` változatossággal, KPI sor (`.kpi-row`) layoutban. _Függőség: StatCard._

- [x] **`GameDetails.tsx` vizuális frissítése** – Fő stat-ok StatCard-ban, játékos statisztikák DataTable-ben, riport kártyák `.ai-marker` osztállyal (lila gradient sáv az AI tartalom jelölésére). A riport megtekintő logika változatlan. _Függőség: StatCard + DataTable._

- [x] **MD export gombok szekció tetejére helyezése** – `GameDetails.tsx`, `PlayerDetails.tsx`, `TeamStatistics.tsx`: az "Export MD" gomb átkerült a fejlécből a "Manuális elemzés beillesztése" / "Manuális szezonértékelés" / "Manuális csapatelemzés" card fejlécébe, az AI generálástól teljesen függetlenül. _2026-05-24_

- [x] **`PlayerDetails.tsx`, `PlayerComparison.tsx`, `TeamComparison.tsx`, `SeasonComparison.tsx`, `SituationalAnalysis.tsx`, `GamesList.tsx`, `Updates.tsx` vizuális frissítése** – Minden `slate-*` hardcoded szín Dark Command Center tokenekre cserélve (`text-primary/secondary/muted`, `bg-surface-*`, `text-positive/negative/cyan/orange/ai/warning`, `badge-*` variánsok). Recharts tooltip/legend/axis/fill tokenek. Funkció változatlan. _2026-05-24_

- [x] **Import felületek (`StandingsImport`, `KosarstatPbpImport`, `FixturesImport`, `RosterImport`, `RoundImport`, `GameQuickImport`, `JsonImport`, `PlayersImport`, `GameManagement`, `PlayersManagement`) vizuális frissítése** – Input / Textarea / Button / Select slate override-ok eltávolítva (globals.css kezeli), szöveg/border/háttér tokenek alkalmazva, badge-ek `badge-*` variánsokra cserélve. Funkció változatlan. _2026-05-24_

- [x] **`LoginForm.tsx` Dark Command Center stílus** – Centrált card, glow-os trophy ikon `shadow-glow-orange`, orange CTA gomb `hover:shadow-glow-orange-hot`, display font uppercase, `animate-fade-slide-up`. Auth flow változatlan. _2026-05-24_

- [x] **Lucide ikon stroke-width audit** – Az egész kódbázison átnézve. Import/admin komponensek (`FixturesImport`, `GameManagement`, `GameQuickImport`, `GamesList`, `JsonImport`, `KosarstatPbpImport`, `PlayersImport`, `PlayersManagement`, `RosterImport`, `RoundImport`, `Updates`, `PlayerComparison`, `PlayerDetails`) mind megkapták a `strokeWidth={1.6}` (standard) vagy `strokeWidth={1.5}` (nagy/dekoratív) értéket. _2026-05-24_

- [x] **Recharts / Chart.js theme objektum** – `lib/chart-theme.ts` létrehozva: `CHART_COLORS`, `CHART_GRID`, `CHART_AXIS`, `RECHARTS_TOOLTIP_STYLE`, `RECHARTS_LEGEND_STYLE`, `CHARTJS_TOOLTIP_STYLE`, `CHARTJS_AXIS_TICK_COLOR`, `CHARTJS_GRID_COLOR` konstansok. `PlayerTrends`, `PostgameShotScatterChart`, `PostgameZoneHeatmapChart` átállítva a közös tokenekre. Barlow Condensed legendák, Dark Command Center paletta. _2026-05-24_

- [x] **Tipográfia / numerika audit** – Ellenőrizve: `PlayerDetails`, `PlayerComparison`, `TeamComparison`, `SituationalAnalysis`, `GamesList`, `GameManagement`, `TeamStatistics` numerikus értékei `font-mono tabular-nums`-szal renderelve. DataTable és StatCard komponensek natívan kezelik. _2026-05-24_

---

## Lezárt sprint – Elemzés oldal export / mentés javítások ✓ (2026-05-26)

- [x] **Export MD gomb mindig látható a fejlécben** – `GameDetails.tsx` és `PlayerDetails.tsx`: az "Export MD" gomb átkerült az oldal fejlécébe (a Vissza gomb mellé), nem a manuális elemzés card belsejébe bújtatva. Minden elemzés oldalon azonnal elérhető töltéskor.

- [x] **PlayerDetails mentés/lekérés javítása** – `PlayerDetails.tsx`-ben korábban nem volt semmiféle infrastruktúra a mentett riportok betöltéséhez és megjelenítéséhez. Hozzáadva: `supabase` import, `PlayerTextReport` típus, `textReports` state, `useEffect` loader (`player_text_reports` tábla), állapot-frissítés mentéskor, és megjelenítő szekció (`.ai-marker` card-ok, típus label, dátum).

- [x] **Lineup és Clutch adatok az export MD-ben** – Új `lib/kosarstat-clutch-parse.ts` utility fájl (megosztott Kosarstat clutch parsing függvények). `lib/export-to-md.ts`: `isStarter?` mező a `PlayerBreakdownExport`-ban, `lineupInfo` és `clutchInfo` mezők a `GameExtraData`-ban, „Kezdő ötös és rotáció" és „Clutch helyzetek" szekciók a `gameStatsToMd`-ben. `GameDetails.tsx`: `is_starter` lekérve a `player_game_stats`-ból, Kosarstat clutch oldalak betöltve és parse-olva a meccs betöltésekor, lineup és clutch átadva az exportnak.

---

## Lezárt sprint – Manuális import minden elemzéshez ✓ (2026-05-26)

- [x] **`save-manual-report` API bővítése** – opcionális `reportType` mező a game-riportoknál, így egy meccshez külön `manual` (postgame) és `pregame_manual` típusú riport mentható ütközés nélkül.

- [x] **SeasonComparison – Player szekció manuális import** – „Manuális szezonértékelés beillesztése" kártya az AI narratíva blokk alatt: Export MD gomb, Textarea, Mentés. Betöltéskor a `player_text_reports` `report_type='manual'` sorból tölti be az előzőleg mentett szöveget.

- [x] **SeasonComparison – Team szekció manuális import** – „Manuális csapatelemzés beillesztése" kártya a csapatelemzés Card után: Export MD gomb (ugyanaz a logika, mint a fejlécben), Textarea, Mentés. Betöltés: `team_text_reports` `report_type='manual'`.

- [x] **SeasonComparison – Pregame szekció manuális import** – „Manuális pregame elemzés beillesztése" kártya a pregame Card után: csak akkor aktív, ha meccs ki van választva; Export MD gomb (`pregameReportToMd`), Textarea, Mentés. Külön `report_type='pregame_manual'` a DB-ben.

- [x] **SeasonComparison – Postgame szekció manuális import** – „Manuális postgame elemzés beillesztése" kártya a GPT szöveges elemzés Card után: Export MD gomb (`postgameReportToMd`), Textarea, Mentés. `report_type='manual'` a `game_text_reports`-ban.

- [x] **Load effektek** – Minden szekció betöltéskor automatikusan lekéri a korábban mentett manuális szöveget a DB-ből és megjeleníti `.ai-marker` card-ban (játékos/csapat/pregame/postgame egyaránt).

---

## Ismert hiányosságok / TODO-k

### Kódból látható problémák

**1. `fouls_drawn` mindig 0**

A `total_fouls_drawn` mező a `player_season_stats_by_season` view-ban nincs aggregálva. Az `app/page.tsx` `?? 0` fallback-kel kezeli. A PlayerStats típusban jelen van, de az adat nem töltődik be. Migráció létezik (`migrations/add-fouls-drawn-to-view.sql`), futtatás szükséges Supabase SQL Editorban.

**2. `offensiveRating` / `defensiveRating` nem NBA metrikák**

Az `app/page.tsx`-ben definiált számítás nem az NBA-féle offensive/defensive rating, hanem:
- `offensiveRating` = ponthatékonyság (Points / scoring attempts)
- `defensiveRating` = védekezési index (steals + blocks + def. rebounds) / meccs

A `StatInfoTooltip.tsx`-ben dokumentálva, de a UI labeleken még a régi név szerepel – átnevezés vagy egyértelmű címkézés szükséges.

**3. `app/layout.tsx` `themeColor` Next 16 viewport API-ba**

A `themeColor: "#050B14"` jelenleg a `metadata` exportban van. Next.js 16-ban a `themeColor` (és pár más mező) átkerült a külön `viewport` exportba. Migrációt érdemes ellenőrizni warning miatt.

**4. Eurobasket.com képek – konfiguráció van, de UI nincs**

A `next.config.ts`-ben engedélyezve van a `www.eurobasket.com`, `www.eurobasket.net`, `basketball.eurobasket.com` domain, de egyetlen komponensben sem jelenik meg játékos fotó. A `players` táblában nincs `photo_url` oszlop sem – DB migráció + import frissítés szükséges előbb.

---

## Backlog (later)

### UX átstrukturálás (későbbi sprint, design mockupok már léteznek)

A `Sidebar_Nav.html` és `Command_Center.html` mockupok már megmutatják az UX átstrukturálás irányát. Ezek **későbbi**, külön sprintben kerülnek megvalósításra – a jelenlegi redesign csak a stílust frissíti, nem a layoutot.

- **AppShell bevezetése (Sidebar + Topbar + Main)** – A 12 tab-os shadcn `Tabs` lecserélése sidebar navigációra (4 csoport: Analitika, Csapat, AI, Admin) + topbar (brand, breadcrumb, akciógombok, user-chip). Komoly UX váltás, külön döntés szükséges róla.
- **Sidebar collapse + perzisztencia** – Kibontható/összecsukható (240px ↔ 64px), localStorage / cookie / Supabase user prefs.
- **Topbar globális kereső (⌘K)** – Játékos / csapat / meccs cross-view kereső. Új funkcionalitás.
- **Topbar breadcrumb** – Liga / szakasz / forduló kontextus megjelenítés.
- **Topbar akciógombok** – Riasztások (notification harang), letöltés, megosztás. Új funkcionalitás mindhárom.
- **Sync státusz indikátor** – „LIVE adat / SZINKRONIZÁLVA · 2 MP" típusú jelzés a Topbarban, mögötte tényleges adatfrissítési időbélyeg-tracking.
- **PageHead minta** – Minden nézet tetején: H1 + badge sor (LIVE, sync, kontextus) + opcionális tab/CTA sor. Ez a layout szintű minta a Command Center mockupból.
- **Mobil viselkedés** – A sidebar mobilon overlay módra váltson, a topbar elemek szűküljenek vagy slide-os modálba kerüljenek. A `3xl` és `4xl` breakpointok kihasználása nagy képernyőkön.

### Funkcionális backlog (UX átstrukturálástól független)

- **Role-alapú hozzáférés-vezérlés (RBAC)** – Admin vs. olvasó szerepkörök szétválasztása; jelenleg minden bejelentkezett felhasználó teljes hozzáféréssel rendelkezik.
- **Többfelhasználós támogatás** – Ha más csapatok is használnák a platformot (multi-tenant), szükség lenne csapat-alapú adatelkülönítésre.
- **Riport cache / frissítés logika** – A pregame riportok hash alapján vannak mentve, de nincs UI jelzés arról, hogy egy riport elavult-e (pl. új meccsek után). A `.ai-marker` osztály mellett egy „STALE" badge jelölhetné.
- **Play-by-play vizualizáció** – A `play_by_play_events` tábla tele van adattal, de nincs UI komponens, amely megjelenítené (pl. negyedenkénti pont grafikon, momentum chart).
- **Shot chart teljes integráció** – A `shotchart_events` tábla és a `PostgameShotScatterChart` / `PostgameZoneHeatmapChart` komponensek léteznek, de nem egyértelmű, hogy minden mérkőzéshez elérhető-e az adat a UI-ból. A Command Center mockupban (`Command_Center.html`) látható dobási térkép vizuális target.
- **`Updates.tsx` kitöltése** – A komponens implementált, de nem egyértelmű mi kerül bele (pl. changelog, adatfrissítés időbélyege, legutóbbi import eredménye).
- **Automatikus adatfrissítés ütemezés** – Jelenleg az adatfrissítés manuális (CLI szkriptek vagy import gombok). Cron-alapú automata frissítés (pl. Vercel Cron) hasznosabb lenne.
- **Keresés és szűrés bővítése** – A `PlayersList` és `PlayersManagement` már tartalmaz névkeresést, de a `GameLog` és más nézetekben nincs.
- **Error boundary és loading state-ek** – A `loadData` hibáit csak `console.error` loggolja, nincs felhasználói visszajelzés betöltési hibánál. A `.skeleton-shimmer` osztály kész, csak be kell vezetni a komponensekben.
- **Eurobasket képek megjelenítése** – `players.photo_url` oszlop hozzáadása, Eurobasket import frissítés, PlayerDetails / PlayersList avatar megjelenítés.

---

## Nyitott kérdések

- **Mi kerüljön az `Updates.tsx`-be?** – A komponens implementált, de tartalma nincs meghatározva.
- **Role-alapú hozzáférés tervezett-e?** – Edzői stáb vs. admin szétválasztás, vagy mindenki teljes jogosultsággal rendelkezik?
- **Eurobasket képek megjelenítése aktív igény-e?** – A konfiguráció kész, az import API létezik, de ki kellene dönteni, hogy bekerül-e az MVP-be.
- **`fouls_drawn` mező hiányzik a view-ból – valós probléma-e?** – Ha a scraper sem gyűjti be ezt az adatot, a view javítása sem segít.
- **Mi az egyértelmű definíciója az `offensiveRating` és `defensiveRating` mutatóknak?** – A jelenlegi implementáció nem az NBA-féle metrikák; UI címkén is egyértelműsíteni kell (pl. „Pont hatékonyság" és „Védekezési index").
- **A 2026/2027 szezon előtt szükséges-e előkészület?** – `lib/season-tables.ts` + SQL migráció bővítése.
- **UX átstrukturálás (sidebar + topbar) mikor kerül sorra?** – A mockupok készen vannak, de jelenleg backlogban; külön sprintben prioritizálandó.
