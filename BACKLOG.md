# BACKLOG.md – ASEStats Projekt

_Utoljára frissítve: 2026-07-19 (AppShell – Sidebar+Topbar navigáció bevezetve)_

---

## Lezárt sprint – AppShell bevezetése (Sidebar + Topbar navigáció) ✓ (2026-07-19)

A `BACKLOG.md` "UX átstrukturálás" tétele alapján, a `AseStat 2/Sidebar Nav.html` mockup mintáját követve a 12 tabos `shadcn Tabs` navigáció lecserélve sidebar+topbar AppShell-re. A `AseStat 2/Command Center.html` mockup csak vízió/stílus-katalógus volt (live scoreboard, AI insights stream, PER/BPM/VORP – ezekhez nincs adatforrás), abból nem került át semmi.

- [x] **`components/AppSidebar.tsx`** (új) – collapsibla sidebar (240px ↔ 64px, `localStorage` perzisztencia, `Cmd/Ctrl+B` gyorsbillentyű), 3 navigációs csoport: **Analitika** (Áttekintés, Játékosok, Elemzések [AI accent], Szituációk), **Csapat** (Tabella, Mérkőzések, Meccs Log, Frissítések), **Admin** (csak adminnak: Kezelés, Játékos Import, Törlés [negatív accent], Import). Mobilon (<768px) CSS-media-query-vel alsó fix, vízszintesen görgethető navsávvá alakul – ez váltja ki a korábbi `MOBILE_GROUPS` pill-szűrő mintát.
- [x] **`components/AppTopbar.tsx`** (új) – breadcrumb (csoport › tab label), user-chip (email, admin esetén `badge-cyan` "Admin" jelzés) + Kijelentkezés gomb. Mobilon a hosszú email elrejtve, csak ikon-gomb marad kijelentkezéshez (túlcsordulás elkerülése).
- [x] **`app/globals.css`** – új "11) Sidebar / AppShell" szekció a mockup CSS-éből portolva (nincs új design token, csak layout-konstansok: `--sb-w-expanded`, `--sb-w-collapsed`).
- [x] **`app/page.tsx`** – `TAB_TRIGGER_CLASS`, `MOBILE_GROUPS`/`mobileGroup`/`isMobileVisible`, a régi `<header>` és `<TabsList>` blokk törölve; `AppSidebar`/`AppTopbar` bekötve. A `Tabs`/`TabsContent` content-switching mechanika (mind a 12 tab, minden komponens-hívás/prop) **változatlan** – csak a navigációs UI cserélődött.
- [x] **Javított bug implementáció közben**: a sidebar collapse állapota kezdetben csak a `.sidebar` elem szélességét változtatta, a szülő `.app-shell` grid-oszlopa nem – üres rés maradt összecsukott állapotban. Javítva: a collapse state felkerült `page.tsx`-be (`onCollapsedChange` callback), az `is-collapsed` class most a grid-wrapperen váltakozik.
- [x] **Javított bug implementáció közben**: mobil nézetben a Topbar (breadcrumb + hosszú email + admin badge + gomb) egy sorban túlcsordult 390px szélességen. Javítva: `flex-wrap`, email elrejtve `md:` alatt, gomb-felirat elrejtve `sm:` alatt.
- [x] Nincs URL routing bevezetve (`activeTab` marad tiszta `useState`, egyeztetett döntés).
- [x] Szezon/Csapat szűrők a főtartalom tetején maradtak (Topbar alatt), nem kerültek a Topbarba.
- [x] `npx tsc --noEmit` és `npm run build` tiszta; böngészős ellenőrzés ideiglenes (soft-deleted) teszt-userrel: desktop nav váltás, admin-only csoport láthatóság, collapse/expand, mobil alsó navsáv – mind működik valós Supabase adaton.
- [x] **Talált, nem javított, nem e sprint scope-ja**: `TeamSelector.tsx` `standings?select=team_name` lekérdezése 400-at ad vissza (preexisting, a navigációs változástól független) – lásd Ismert hiányosságok #5.

---

## Lezárt sprint – Tailwind design token audit ✓ (2026-07-19)

Teljes kódbázis-audit: a Dark Command Center redesign sprint (2026-05-24) után visszamaradt, sosem migrált shadcn default Tailwind paletta osztályok (`slate-*`, `sky-*`, `indigo-*`, `violet-*`, `emerald-*`, `amber-*`, számozott `cyan-*`/`orange-*` árnyalatok stb.) cseréje a projekt design tokenjeire, a CLAUDE.md "Hardcoded hex szín tiltott" szabálya szerint.

- [x] **`components/ui/tooltip.tsx`** – `border-slate-700 bg-slate-800 text-slate-50` → `border-border-subtle bg-popover text-popover-foreground` (minden tooltipet érintett, app-szerte)
- [x] **`SeasonSelector.tsx`, `TeamSelector.tsx`** – redundáns `bg-slate-800 border-slate-700` Select override-ok eltávolítva (a Select komponens már tokenizált, az override felülírta feleslegesen)
- [x] **`StatInfoTooltip.tsx`, `TerminologyGlossary.tsx`** – slate/orange-300 → secondary/primary/orange tokenek
- [x] **`FixturesImport.tsx`, `RosterImport.tsx`, `RoundImport.tsx`** – figyelmeztető/hiba doboz `amber-500`/`red-950` → `warning`/`negative` tokenek (egységes minta mindhárom fájlban)
- [x] **`GameQuickImport.tsx`, `JsonImport.tsx`, `KosarstatPbpImport.tsx`** – JsonImport preview táblázat összes szemantikus oszlopszíne (steal/turnover/GP/VAL/ORtg/DRtg/TS%/eFG%) tokenizálva; KosarstatPbpImport törlés gomb felesleges `bg-red-700` override törölve (a `variant="destructive"` már helyesen színez)
- [x] **`PlayersImport.tsx`, `PlayersManagement.tsx`, `GameManagement.tsx`** – amber/emerald/red figyelmeztető dobozok és hover state-ek → warning/positive/negative tokenek
- [x] **`GameDetails.tsx`, `GamePbpCharts.tsx`, `TeamComparison.tsx`** – `GamePbpCharts.tsx` teljesen átállítva a `lib/chart-theme.ts` közös Recharts konstansaira (ez a fájl kimaradt az 05-24-es chart-theme migrációból)
- [x] **`SeasonComparison.tsx`** (47 hely) – `cyan-*`/`sky-*`/`indigo-*` → `cyan` token (a projekt egyetlen kék accentje), `violet-*`/az LLM-generáló gombok → `ai` token (a `GameDetails.tsx` már bevett `bg-ai text-white hover:opacity-90` mintája szerint), `orange-*` számozott árnyalatok → `orange` token
- [x] **Valódi bug**: `SeasonComparison.tsx`-ben 10 helyen hiányzott a szóköz két class között (`border-border-subtlebg-surface-2/40`), ami érvénytelen Tailwind class-t eredményezett – sem a border, sem a háttérszín nem érvényesült ténylegesen ezeken az elemeken. Javítva.
- [x] **`GameInput.tsx`** – legnagyobb volumenű (118 db) slate/emerald/violet paletta-használat, de a fájl **sehol nincs importálva** (holt kód) – nem érintve, funkcionális döntés nélkül nem törölhető
- [x] Build (`next build`) és `tsc --noEmit` tiszta; lint változatlan (7 db, a sprinttől független preexisting warning)

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

**1. ~~`fouls_drawn` mindig 0~~ – ellenőrizve, már megoldva (2026-07-19)**

A `migrations/add-fouls-drawn-to-view.sql` migráció már le van futtatva (Supabase migrációs történetben: `add_fouls_drawn_to_view`, 2026-05-14). A `player_season_stats_by_season` view `total_fouls_drawn` oszlopa valós, játékosonként eltérő értékeket tartalmaz (pl. Perl Zoltán: 9, Trammell Darrion: 12 – nem mindenki 0, ahogy egyeseknél legitim is a 0). A `lib/player-stat-mapping.ts` `ps.total_fouls_drawn ?? 0` mappingje helyesen olvassa mind `hooks/useGameData.ts`, mind `hooks/useFilterData.ts` útvonalon. Nincs teendő.

**2. ~~`offensiveRating` / `defensiveRating` nem NBA metrikák~~ – címkézés javítva (2026-07-19)**

Vizsgálat közben kiderült, hogy ez mélyebb probléma volt puszta elnevezésnél: a kódbázisban **három különböző** "rating" létezik azonos-hangzású néven:

1. Csapat-szintű `ortg`/`drtg`/`netRtg` (`lib/team-analysis.ts`) – valódi NBA-stílusú per-100-poss rating, korrekt, nem érintett.
2. Játékos-szintű, **meccsenkénti** `offensiveRating`/`defensiveRating` (`GamePerformance` típus) – Hunbasket saját, hivatalos mutatója (~0–160 skála), `StatInfoTooltip` "ortg"/"drtg" kulcs alatt már helyesen dokumentálva.
3. Játékos-szintű, **szezon-aggregált** `offensiveRating`/`defensiveRating` (`PlayerStats` típus) – saját képlet: pont/dobáskísérlet ill. (steal+blokk+véd.lepattanó)/meccs, ~0.5–1.5 skála.

A valódi hiba: a `PlayerDetails.tsx` a 2-es metrikát ("Offensive Rating" cím, Hunbasket-skála) mutatta, alatta egy "Szezon: X" sorral, ami viszont a 3-as metrikát (teljesen más képlet, más nagyságrend) jelenítette meg – mintha ugyanannak a mutatónak lenne a szezonátlaga. Javítva: a "Szezon:" sor mostantól a `player.gameHistory` teljes szezonos Hunbasket ORtg/DRtg átlagát mutatja (`seasonAvgORtg`/`seasonAvgDRtg`), nem a 3-as metrikát. A `PlayerComparison.tsx` "Fejlett statisztikák" grafikonja (3-as metrika) átcímkézve `OffRtg`/`DefRtg` → `Pont hat.`/`Véd. idx` (a `PlayersList.tsx` mintája szerint), a táblázat alatti Hunbasket-sor (2-es metrika) `Offensive Rating`/`Defensive Rating` → `ORtg`/`DRtg` + `StatInfoTooltip` a disztinkció miatt. `lib/dashboard-types.ts`-ben mindkét típusnál (`PlayerStats`, `GamePerformance`) kommentek jelzik, hogy a két azonos nevű mező más képlet. `export-to-md.ts` már eddig is helyesen címkézte ("Offenzív index, nem NBA OrtG"), nem érintve. `next build` + `tsc --noEmit` tiszta.

**3. ~~`app/layout.tsx` `themeColor` Next 16 viewport API-ba~~ – ellenőrizve, nem releváns (2026-07-19)**

A `themeColor` a jelenlegi `app/layout.tsx` `metadata` exportjában nincs jelen (csak `title`/`description`). A `next build` tiszta, nincs `viewport`/`themeColor` figyelmeztetés. A leírás egy archív mockup-fájlból (`AseStat 2/layout.tsx`, a korábbi UX-mockup export) származott, ami nem a mai kódbázis része – nincs teendő.

**4. Eurobasket.com képek – konfiguráció van, de UI nincs**

A `next.config.ts`-ben engedélyezve van a `www.eurobasket.com`, `www.eurobasket.net`, `basketball.eurobasket.com` domain, de egyetlen komponensben sem jelenik meg játékos fotó. A `players` táblában nincs `photo_url` oszlop sem – DB migráció + import frissítés szükséges előbb.

**5. `standings` lekérdezés 400-at ad vissza (`TeamSelector.tsx`)**

Az AppShell sprint böngészős ellenőrzése közben (2026-07-19) észlelve: a `TeamSelector.tsx` `supabase.from('standings').select('team_name').order('team_name')` lekérdezése 400-as hibát ad (`console: Failed to load resource: the server responded with a status of 400`). Nem a navigációs változás okozza – a komponens nem volt érintve ebben a sprintben. Feltehetően hiányzó/rossz oszlopnév vagy RLS-policy probléma a `standings` táblán. Külön vizsgálat szükséges.

---

## Backlog (later)

### UX átstrukturálás – AppShell alapja kész, finomítások később

Az **AppShell (Sidebar + Topbar) bevezetése megtörtént** (lásd fent, 2026-07-19-es lezárt sprint) a `Sidebar Nav.html` mockup alapján. A `Command Center.html` mockup elemei (live scoreboard, AI insights stream, PER/BPM/VORP ranglista, ⌘K kereső) vízió-jellegűek voltak, nincs mögöttük adatforrás – ezek **nem** kerültek be, és csak akkor relevánsak, ha a mögöttes funkció (élő adat, AI stream) külön döntés nyomán megépül.

- **Topbar globális kereső (⌘K)** – Játékos / csapat / meccs cross-view kereső. Új funkcionalitás, nincs API mögötte.
- **Topbar akciógombok** – Riasztások (notification harang), letöltés, megosztás. Új funkcionalitás mindhárom, nincs API mögötte.
- **Sync státusz indikátor** – „SZINKRONIZÁLVA · X perce" típusú jelzés a Topbarban, mögötte tényleges adatfrissítési időbélyeg-tracking (jelenleg nincs ilyen metaadat tárolva).
- **Sidebar nav-item numerikus meta badge-ek** (pl. játékosszám, meccsszám) és `⌘1..9` gyorsbillentyűk az egyes nav-itemekhez – a mockupban megvan, a jelenlegi sprintben tudatosan kihagyva a scope szűkítése miatt.
- **Mobil viselkedés finomítása** – a sidebar jelenleg CSS-media-query-vel alsó fix navsávvá alakul (nem overlay-menüvé); ha ez nem megfelelő UX nagyobb admin listáknál, felülvizsgálandó. A `3xl`/`4xl` breakpointok kihasználása nagy képernyőkön még nem történt meg.

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
- ~~`fouls_drawn` mező hiányzik a view-ból~~ – ellenőrizve, a migráció már lefutott, az adat valós (lásd Ismert hiányosságok #1).
- ~~Mi az egyértelmű definíciója az `offensiveRating` és `defensiveRating` mutatóknak?~~ – tisztázva és címkézve (lásd Ismert hiányosságok #2).
- **A 2026/2027 szezon előtt szükséges-e előkészület?** – `lib/season-tables.ts` + SQL migráció bővítése.
- **UX átstrukturálás (sidebar + topbar) mikor kerül sorra?** – A mockupok készen vannak, de jelenleg backlogban; külön sprintben prioritizálandó.
