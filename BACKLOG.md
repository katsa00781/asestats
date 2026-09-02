# BACKLOG.md – ASEStats Projekt

_Utoljára frissítve: 2026-09-02 (Hotfix: menetrend import – Playwright böngésző, csapat-névdrift, szezon-illeszkedés)_

---

## Aktív sprint – Mobil (iOS) Expo alkalmazás

**S1 – Tervdokumentáció ✓ (2026-08-30)**

Felhasználói döntések: **Expo / React Native** (nem PWA, nem Capacitor, nem natív Swift) · **fogyasztói nézetek** scope (az import/admin tabok desktop-only maradnak) · **vizuális AI design promptok** · **NativeWind v4** styling · **victory-native XL (Skia)** chartok · az Elemzés tabon **riportok + számított elemzések**.

- [x] **`context/mobile/mobile-overview.md`** – termékdefiníció, miért nem elég a reszponzív web (7 konkrét blokkoló felsorolva), a 8 fogyasztói nézet scope-ja, az „Elemzés" tab pontos határa, iOS információs architektúra: **8 web tab → 5 iOS tab** (Ma / Játékosok / Meccsek / Tabella / Elemzés), tudatos funkcionális eltérések a webtől.
- [x] **`context/mobile/mobile-architecture.md`** – izolált `mobile/` Expo projekt npm workspace **nélkül** (indoklással: hoisting-ütközés a web React 19 és az Expo pinnelt React-je között + 30+ fájl mozgatása); Metro `watchFolders` + `extraNodeModules` `@core` alias a gyökér `lib/`-re; RN Supabase kliens AsyncStorage adapterrel; lusta betöltési stratégia.
- [x] **`context/mobile/mobile-ui-context.md`** – teljes token-híd a `globals.css`-ből szó szerint; **új mobil tokenek** (44pt tap target, pt-alapú típusskála, 4pt spacing rács); glow **rétegzéssel**, nem shadow-val (RN korlát); hover → pressed leképezés; StatCard → **StatTile**, DataTable → **StackedRow + StatMatrix** (fagyasztott első oszlop).
- [x] **`context/mobile/mobile-design-prompts.md`** – **15 prompt** (P0 style tile + P1–P14 képernyők), közös `DS-BLOKK` kontextussal, valós magyar mintaadattal, lefedettség-ellenőrző táblázattal és elfogadási checklistával.

**Felderítési leletek, amikre a terv épül:**

- **A `lib/` elemző mag bizonyítottan tiszta** – 15 modul (~9 500 sor: `stat-formulas`, `positions`, `terminology`, `style-vocabulary`, `dashboard-types`, `player-stat-mapping`, `season-tables`, `fetch-all-rows`, `situational-analysis`, `kosarstat-clutch-parse`, `postgame-report`, `player-analysis`, `player-postgame`, `pregame-scouting`, `team-analysis`) **nulla külső importtal** – se React, se Next, se DOM, se Supabase. Módosítás nélkül futtatható RN alatt. (A `situational-analysis.ts` naiv DOM-grepen fals pozitívot ad: a 260. sorban `window` nevű **lokális** változó van.)
- **Az AI riportok olvasása nem igényel API route-ot** – a kliens közvetlen `supabase.from('game_text_reports' | 'team_text_reports' | 'player_text_reports')` SELECT-tel olvas. Mind a 14 `app/api/*` route `requireAdmin`-t futtat és mutáló → a fogyasztói scope-on kívül.

**Következő lépések (még nem indultak):**

- [ ] **S2 – Vizuális validáció (felhasználói lépés)**: P0, majd P2 és P8 lefuttatása a választott eszközben. Ha a design nyelv nem áll össze, a `mobile-ui-context.md` módosul, és csak utána megy a maradék 11 prompt.
- [ ] **S3 – Expo váz**: `mobile/` létrehozása, Metro/tsconfig alias, NativeWind config a tokenekkel, `expo-font`, Supabase kliens, auth + login. **Első feladat: `@core/stat-formulas` import füstteszt** – ha a Metro alias nem működik, fallback az npm workspace-re promotálás.
- [ ] **S4 – Adatréteg**: `useFilterData`/`useGameData` port lusta betöltéssel, szűrő perzisztálás AsyncStorage-ban.
- [ ] **S5+ – Képernyők** prioritási sorrendben: Ma → Meccsek → Játékosok → Tabella → Elemzés.
- [ ] **Új npm csomagok jóváhagyása S3 előtt** (pontos verziókkal): `expo`, `expo-router`, `expo-font`, `nativewind`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `victory-native`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`, `lucide-react-native`.

---

## Hotfixek

**H1 – „Invalid Refresh Token: Refresh Token Not Found" auth konzolhiba ✓ (2026-09-02)**

Tünet: a dashboard betöltésekor `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` jelent meg a konzolban / a Next.js dev overlay-en. A hibát a `@supabase/auth-js` `_recoverAndRefresh()` logolja induláskor, amikor a localStorage-ban tárolt refresh token már nem érvényes a szerveren (lejárt, rotálódott, vagy két kliens-példány versenyzett érte). A könyvtár ilyenkor magától eldobja a sessiont, de az alkalmazás nem kezelte a hibaágat.

- [x] **`lib/supabase.ts`** – a kliens `globalThis`-en cache-elt singleton lett dev módban (a Fast Refresh modul-újraértékelése eddig több `GoTrueClient` példányt hozhatott létre, amelyek ugyanazt a rotálódó refresh tokent használták → verseny → „Refresh Token Not Found"). Explicit `auth` opciók: `persistSession`, `autoRefreshToken`, `detectSessionInUrl: false` (csak email/jelszó flow van). A `storageKey` **nem** változott, így a meglévő sessionök érvényben maradnak.
- [x] **`lib/auth-context.tsx`** – a `getSession()` hibaága kezelve: érvénytelen tokennél `signOut({ scope: 'local' })` üríti a beragadt localStorage bejegyzést, a UI pedig tisztán a bejelentkező képernyőre esik vissza. Az effect kapott `active` flaget (unmount utáni `setState` ellen), a `signOut()` pedig lokális fallbacket, ha a szerver már nem ismeri a sessiont.
- [x] **`lib/api-fetch.ts`** – az `authFetch` eddig csendben eldobta a `getSession()` hibáját; mostantól figyelmeztet és lokálisan kijelentkeztet, így a felület nem marad „bejelentkezve" állapotban érvénytelen tokennel.
- [x] `npx tsc --noEmit` + `npx eslint` tiszta.

**Megjegyzés a felhasználónak:** a már beragadt tokent a böngészőben egyszer ki kell söpörni (kijelentkezés vagy a site adatainak törlése) – utána a hiba nem jön vissza. Funkcionális változás nincs, az auth flow ugyanaz.

**H2 – Menetrend import „1 kóddal állt le" ✓ (2026-09-02)**

Tünet: a Menetrend import gomb hibára futott, a felületen csak az `Az importáló script (scrape-hunbasket-fixtures.ts) 1 kóddal állt le.` üzenet látszott, ok nélkül.

Valódi ok: **nem kódhiba** – a Playwright böngésző-binárisok hiányoztak a gépről (`~/Library/Caches/ms-playwright/` üres volt). A `playwright ^1.58.0` frissítés után a `chromium_headless_shell-1208` build kellene, de nem volt letöltve, így a `chromium.launch()` azonnal dobott, a szkript pedig `process.exit(1)`-gyel állt le. Ugyanez az összes többi scraping szkriptet is érintette (közös `chromium.launch()` út).

- [x] **`npx playwright install chromium`** lefuttatva – Chrome Headless Shell 145.0.7632.6 (v1208) + ffmpeg letöltve. Nem kódváltozás, gép-szintű környezetjavítás; Playwright-frissítés után újra szükséges lehet.
- [x] **Ellenőrzés**: `npx tsx scrape-hunbasket-fixtures.ts` → `Parsed fixtures: 182 · Upserted: 182 · Played: 182 · Scheduled: 0 · Fixture import completed.` – az import hibátlanul lefut.
- [x] **`components/FixturesImport.tsx`** – hiba esetén is megjelenik a script `stdout`/`stderr` kimenete (eddig a `throw` előbb futott le, mint a `setStdout`/`setStderr`, így a valódi hibaüzenetet a UI eldobta és csak a generikus exit-kód üzenet maradt). Ez tette feleslegesen nehézzé a hiba beazonosítását. Funkcionális változás nincs, csak diagnosztika.
- [x] **`components/RosterImport.tsx`, `components/RoundImport.tsx`** – ugyanaz a javítás átvezetve (a `setStdout`/`setStderr` a `throw` elé került). Mindkét route (`hunbasket-roster-import`, `hunbasket-round-import`) küldi a `stdout`/`stderr` mezőt a hibaválaszban, tehát eddig is volt mit megjeleníteni, csak a kliens dobta el.
- [x] **`components/KosarstatPbpImport.tsx` – nem igényelt változtatást.** Eltérő architektúra: a POST fire-and-forget (csak 400/409 validációs hibát adhat vissza, script-kimenet nélkül), a futás állapotát a `refreshImportStatus()` polling olvassa a GET endpointról, és az a `stdoutTail`/`stderrTail` értékeket a hibaágon (`lastError` / nem nulla `exitCode`) is beállítja. A kimenet tehát itt már eddig is látszott hiba esetén.
- [x] `npx tsc --noEmit` + `npx eslint` tiszta.

**H3 – Menetrend import: csapat-névdrift és szezon-illeszkedés ✓ (2026-09-02)**

A H2 (hiányzó Playwright böngésző) után az import a **2026/2027-es** menetrenden újra elszállt, ezúttal a DB-írás közben:
`Failed to create team OSE Lions: duplicate key value violates unique constraint "teams_short_name_key"`.

Ok: a `scrape-hunbasket-fixtures.ts` **szigorú** névegyeztetést használt (`findTeamByNameStrict`) és ismeretlen névnél **automatikusan új csapatot hozott létre** – szemben a `scrape-hunbasket.ts` box-score importtal, ahol a névdrift-védelem már megvolt. A 26/27-es szezonban több klub szponzorneve megváltozott, így a szigorú match elbukott, az automatikus insert pedig a `short_name` UNIQUE megszorításba ütközött (`"OSE Lions"` → `short_name: "OSE"`, ami már a `"MVM-OSE Lions"`-é volt).

Felderítés – a 26/27-es menetrend 15 egyedi csapatneve: 11 pontos találat, 2 szponzornév-drift (`"OSE Lions"`, `"Falco KC Szombathely"`), 2 ismeretlen (`"Budapesti Honvéd Sportegyesület"`, `"PHOENIX Fóti Tigrisek"`).

- [x] **`scrape-hunbasket-fixtures.ts` – névdrift-védelem** a box-score importtal azonos szabály szerint: `findTeamByNameFuzzy` (feloldja a szponzornév-driftet), alapból **nincs** automatikus csapat-létrehozás (`HUNBASKET_ALLOW_NEW_TEAMS=1` kell hozzá), `short_name` ütközésnél cache-frissítés → újrapróbálás → `short_name: null` fallback.
- [x] **Előellenőrzés (`resolveTeams`)** – minden csapatnév feloldása **bármilyen DB-írás előtt** megtörténik, és egyszerre jelenti az ÖSSZES ismeretlen nevet. Korábban az import a közepén szállt el, félig megírt állapotot hagyva, és csak az első hibás nevet mutatta.
- [x] **Csapatdöntések (felhasználói jóváhagyással)**: a `"Budapesti Honvéd Sportegyesület"` az `"Endo Plus Service-Honvéd"` **átnevezése** – a `teams` sor `name` mezője módosult, a `team_id` (`e2a2ab1c-…`) és a hozzá kötött 46 játékos változatlan, a klubtörténet folytonos. A `"PHOENIX Fóti Tigrisek"` **új klubként** felvéve.
- [x] **`scrape-utils.ts` – `TEAM_NAME_ALIASES` klub-átnevezési térkép.** Az átnevezés regressziót okozott: a 24/25 és 25/26 menetrend-oldalak még a régi nevet írják, amit a fuzzy matching nem tud kitalálni (1 közös token a szükséges 2-ből) – a régebbi szezonok újraimportálása duplikált `teams` sort termelt volna. Az alias a `findTeamByNameStrict`/`findTeamByNameFuzzy` közös belépési pontján old fel, így **mind a 4 scraper** örökli. Sémamódosítás nem történt. Klub átnevezésekor ide kell felvenni a régi nevet.
- [x] **Szezon-illeszkedés kapu (`assertFixturesMatchSeason`)** – a menetrend URL slugja és a kiválasztott szezon egymástól függetlenül állítható; ha elcsúsznak, egy másik évad teljes menetrendje kerül be rossz `season_id` alá. A szkript mostantól a `seasons.start_date`/`end_date` ellen ellenőrzi a beolvasott dátumokat: >10% kilógásnál **abortál írás előtt**, ≤10%-nál (elhalasztott meccs) csak figyelmeztet.
- [x] **Üres eredmény = hiba** – 0 kiolvasott mérkőzés eddig „sikeres" importként futott le. Rossz URL-nél / megváltozott tábla-szerkezetnél mostantól explicit hiba.
- [x] **Ellenőrzés**: mindhárom szezon hibátlanul importál (24/25, 25/26, 26/27: 182–182–182 fixture), a `teams` tábla 17 soros duplikátum nélkül, a szezon-kapu a valós hibát elfogja (x2425 menetrend a 2025/2026 szezonra → abort írás előtt), rossz URL → abort. `npx tsc --noEmit` + `npx eslint` tiszta.

- [x] **Visszamenőleges adattisztítás ✓ (felhasználói jóváhagyással)** – a szezon-kapu 182 hibás sort talált: a `league_fixtures` 2025/2026-os szezonjában 417 sor volt, ebből **182 valójában a 2024/2025-ös menetrend** (`source_url: …/x2425/hun`, 2024-09-27 – 2025-04-12 dátumokkal), egy korábbi, 2026-04-20-i elcsúszott importból. Törlés előtt: a 182 sor JSON mentése, ellenőrzés hogy mind a szezonhatáron kívül van, és hogy **mind a 182 meccs megvan a helyes 2024/2025-ös szezon alatt** (hiányzó: 0 → adatvesztés nincs). Törölve: 182 sor.

**Végállapot** (`league_fixtures`, szezonhatáron kívüli sor mindenhol 0):

| Szezon | Összesen | Lejátszott | Következő |
|--------|----------|-----------|-----------|
| 2024/2025 | 182 | 182 | 0 |
| 2025/2026 | 235 | 221 | 14 |
| 2026/2027 | 182 | 0 | 182 |

A 25/26-os 235 = 182 alapszakasz + 53 playoff; a 14 „következő" mind a `hun_ply` playoff oldalról jön, kiírt de le nem játszott párharc-meccsek (rövidebben eldőlt sorozatok) – nem hiba.

---

---

## Lezárt sprint – Funkcionális backlog tételek ✓ (2026-07-19)

A négy sprintes terv (RBAC → 2026/2027 szezon-előkészület → design konzisztencia → funkcionális backlog) utolsó, funkcionális egysége. Az "élő adat" jellegű tételek (automatikus adatfrissítés ütemezés) kimaradtak, mert a `.github/workflows/scrape.yml` már ütemezett és kézzel indítható – nem volt hozzá új munka.

- [x] **`components/TeamSelector.tsx` 400-fix** – a nemlétező `standings.team_name` oszlopra hivatkozó, mindig hibázó lekérdezés törölve; a csapatlista mostantól közvetlenül a `teams` táblából töltődik be (ami eddig is a működő fallback út volt). A standings-ból csapat-auto-létrehozó logika is törölve, mert kizárólag az eltávolított hibás lekérdezésre épült – nem volt funkcionális hatása korábban sem (a lekérdezés sosem sikerült). Ismert hiányosságok #5 lezárva.
- [x] **Riport "Elavult" badge** (`components/SeasonComparison.tsx`) – a játékos szezonértékelés és a csapat AI-elemzés mellett `badge-warning` "Elavult" jelzés jelenik meg, ha a szezon/csapat legutóbbi meccsének dátuma újabb, mint a riport generálási időpontja (séma-módosítás nélkül, a már betöltött `games` propból számolva). **Tudatosan kihagyva**: `GameDetails.tsx` per-meccs pregame/postgame riportjai – egy lezárult meccs adatai nem változnak új meccsektől függetlenül, ott a "elavult" jelzésnek nincs értelmes jelentése a jelenlegi adatmodellel.
- [x] **Play-by-play momentum + Four Factors chart** (`components/GamePbpCharts.tsx`, `GameDetails.tsx`) – új kumulatív pontkülönbség vonaldiagram a `kosarstat_game_quarter_stats.cumulative_points` mezőből (eddig csak számításban használt, vizualizálatlan adat), és Four Factors (eFG%/TOV%/ORB%/FT Rate) oszlopdiagram a `kosarstat_game_team_metrics`-ből – ehhez `GameDetails.tsx` egy új lekérdezést kapott (`teamMetrics` state), a `chart-theme.ts` tokenjeivel.
- [x] **Keresés bővítése** (`components/PlayersList.tsx`) – játékosnév-kereső hozzáadva a `GameLog.tsx` meglévő ellenfél-kereső mintája szerint (Input + Search ikon + X törlés). **Korrekció a tervhez képest**: felderítés közben kiderült, hogy a `GameLog.tsx`-ben már létezik játékos-szűrő (dropdown, nem csak ellenfél-kereső) – ott nem volt szükség további munkára.
- [x] **Loading/hiba visszajelzés** (`app/page.tsx`) – az első betöltéskor (még nincs adat) a szöveges "Adatok betöltése..." helyett `.skeleton-shimmer` blokkok jelennek meg (eddig sehol nem használt CSS osztály); háttérfrissítéskor (van már adat) marad a diszkrét spinner. `filterError`/`dataError` mostantól Sonner `toast.error`-t is dob a már meglévő inline hibapanel (retry gombbal) mellett – erősebb, azonnali visszajelzés adatbetöltési hibánál.
- [x] `npx tsc --noEmit` + `npm run build` tiszta minden lépés után.

---

## Lezárt sprint – Design konzisztencia az AseStat 2 mockupokkal ✓ (2026-07-19)

Az `AseStat 2` mappa mockupjaival (`Sidebar Nav.html`, `StatCard.html`, `DataTable.html`) szembeni audit alapján a maradék vizuális rések bezárása. Az élő adatos mockup-elemek (sync/live pill, ⌘1..9 gyorsbillentyűk) tudatosan kimaradtak – nincs mögöttük adatforrás/funkció.

- [x] **`components/GameInput.tsx` törölve** – sehol nem volt importálva (holt kód, ~116 hardcoded paletta-szín), felhasználói döntés alapján törölhető.
- [x] **Chart-színek tokenizálva** a meglévő `lib/chart-theme.ts` konstansaira:
  - `components/TeamStatistics.tsx` – slate/szín hex-ek → `CHART_COLORS`/`CHART_GRID`/`CHART_AXIS`/`RECHARTS_TOOLTIP_STYLE`/`RECHARTS_LEGEND_STYLE`.
  - `components/SeasonComparison.tsx` (18k soros fájl, 194 hardcoded hex előfordulás) – szkriptelt, érték-szintű csere ugyanezekre a tokenekre; `npx tsc --noEmit` + `npm run build` ellenőrizve utána.
  - `components/PostgameShotScatterChart.tsx` – `#050B14`/`#f8fafc` → `CHART_COLORS.base` (új konstans a `chart-theme.ts`-ben, a meglévő `--bg-base` design token JS-oldali tükrözése) / `CHART_COLORS.primary`.
- [x] **Sidebar mockup-részletek** (`app/globals.css` "Sidebar/AppShell" szekció + `components/AppSidebar.tsx`):
  - Avatar jelenlét-pont (`.sb-avatar::after`, zöld pont `--bg-surface-1` gyűrűvel).
  - Összecsukott nézet tooltip nyila (`.nav-item-tip::before`, forgatott négyzet caret).
  - Nav-item meta badge-ek (`.nav-item-meta` CSS + `AppSidebar` `navMeta` prop) – a Játékosok és Mérkőzések nav-item valós darabszámot mutat (`playersBySeason.length`, `games.length`), a `page.tsx`-ben már betöltött adatokból, új lekérdezés nélkül.
- [x] **Topbar oldalcím** (`components/AppTopbar.tsx`) – a breadcrumb alá nagy (2xl/3xl) Barlow Condensed `h1` került az aktív tab címével, a mockup `.topbar h1` mintája szerint.
- [x] `npx tsc --noEmit` + `npm run build` tiszta mindkét körben.
- [ ] **Nem változtatott, tudatosan**: `--text-secondary`/`--text-muted` jelenlegi (mockupnál világosabb) értékei maradnak – szándékos olvashatósági eltérés. Sync/live pill és ⌘-gyorsbillentyűk kimaradtak (nincs mögöttük funkció).

---

## Lezárt sprint – 2026/2027 szezon előkészület ✓ (2026-07-19)

Felderítés kimutatta, hogy az SQL-oldali munka nagyrészt már készen volt (`migrations/add-player-game-stats-2026-2027.sql`, `lib/season-tables.ts` mapping) egy korábbi, nem dokumentált munkamenetből. Ez a sprint a hátralévő kód-fixet és a dokumentáció szinkronizálását végezte el.

- [x] **`components/Updates.tsx`** – a hardcoded `player_game_stats_2025_2026` lekérdezés lecserélve: a `seasons` táblából kiolvasott `is_current` szezon nevéből `getSeasonStatsTable()`-lel derivált táblanévre. Szezonváltáskor kód-módosítás nélkül naprakész marad.
- [x] **`HOWTO-uj-szezon.md`** – teljesen újraírva, hogy a valódi migráció (7 lépés: tábla+FK, RLS, UNION view, 3 INSTEAD OF trigger, aggregált view-k, seasons sor, ellenőrzés) lépéseit tükrözze; a korábbi verzió elavult egyszerűsítést tartalmazott (trigger-frissítés és RLS teljesen hiányzott belőle). Új szakasz az RBAC-kompatibilis RLS-ről és egy külön "Szezonkezdési checklist"-ről (is_current váltás + CI repo variables + első import).
- [x] `npx tsc --noEmit` tiszta.
- [ ] **Hátralévő kézi lépés (felhasználó)**: `migrations/add-player-game-stats-2026-2027.sql` futtatása a Supabase SQL Editorban, ha még nem történt meg – enélkül a `lib/season-tables.ts` mappingben szereplő 2026/2027 bejegyzés "üres" hivatkozás.
- [ ] **Szezonkezdéskor** (nem most): `is_current` átbillentés + GitHub Actions repo variables (`HUNBASKET_SEASON_SLUG`/`HUNBASKET_SEASON_NAME`/`KOSARSTAT_SEASON_NAME`) átállítása – lásd `HOWTO-uj-szezon.md` checklist.

---

## Lezárt sprint – RBAC: Admin vs. Felhasználó ✓ (2026-07-19)

Felhasználói döntés alapján: MINDEN írás (import, törlés, kezelés ÉS AI riport generálás/mentés) admin-only, a sima bejelentkezett felhasználó tisztán olvasó. Az admin szerepkör a Supabase `user_metadata.role === 'admin'` alapján dől el (Dashboardban kézzel állítva, ahogy eddig).

- [x] **`lib/api-auth.ts`** – új `requireAdmin()` guard: token-validálás + `user_metadata.role === 'admin'` ellenőrzés, hiánya esetén 403. A `requireAuth` megmarad jövőbeli olvasó route-okhoz.
- [x] **Mind a 13 `app/api/*` route** átállítva `requireAuth` → `requireAdmin`-ra (minden route mutáló; a riport-olvasás kliens-oldali Supabase lekérdezés, nem API route – azt nem érinti).
- [x] **`app/page.tsx`** – a `standings` tabon a `StandingsImport` mostantól `{isAdmin && ...}` mögött (a `StandingsView` mindenkié marad); a `GamesList` `isAdmin` propot kap.
- [x] **`components/GamesList.tsx`** – Szerkesztés és Törlés gombok csak adminnak renderelődnek (`isAdmin` prop, default false).
- [x] **`migrations/extend-rbac-standings-teams.sql`** (új) – admin-only INSERT/UPDATE/DELETE a `standings` és `teams` táblákra; a korábbi „bármely authenticated írhat" standings-policy cseréje. Dinamikusan törli a meglévő írás-policykat, SELECT marad mindenkinek. – **KÉZZEL FUTTATANDÓ Supabase SQL Editorban!** Előfeltétel: `add-rbac-rls.sql` (is_admin() függvény) lefuttatva – **ellenőrizendő, hogy élesben le van-e futtatva!**
- [x] `npx tsc --noEmit` + `npm run build` tiszta.
- [ ] **Hátralévő kézi lépés**: a két migráció futtatása/ellenőrzése Supabase-ben + böngészős teszt nem-admin userrel (403 az API-n, rejtett gombok a UI-n).

---

## Lezárt sprint – Elemzések oldal reszponzivitás-hiba javítása ✓ (2026-07-19)

Az AppShell sprint után jelzett hiba: a sidebar bevezetése óta az Elemzések (SeasonComparison) oldal, főleg a post-game jelentés generálásakor, vízszintesen túlcsordult – görgetni kellett, sidebar állapottól és ablakmérettől függetlenül. Böngészős console-diagnosztikával (`scrollWidth`/`clientWidth` összevetés) behatárolva, két különálló gyökérok:

- [x] **`app/globals.css` – `.app-shell > main { min-width: 0 }`** – a sidebar melletti tartalom-grid-cella alapból a benne lévő legszélesebb elem (pl. fix-szélességű play-by-play táblázat) min-content méretére hízott, ez nyomta szélesebbre az egész oldalt a viewportnál. Ez önmagában nem volt elég (lásd következő pont).
- [x] **`app/globals.css` – `.grid > * { min-width: 0 }`** (a valódi fő ok) – a CSS Grid specifikáció mindkét tengelyen (nem csak a flex fő tengelyén) tartalom-alapú minimumot ad a grid-elemeknek. Az Elemzések oldalon (főleg a post-game szekcióban) rengeteg beágyazott `grid grid-cols-*` elrendezés van (chartok, KPI blokkok, táblázatok), ezek mindegyike egyénileg blokkolta a zsugorodást, ezért a sidebar-fix nem oldotta meg a post-game nézetet. Konzol-diagnosztika: üres classNevű, `clientWidth:0` / `scrollWidth:~1320` divek = a Recharts `ResponsiveContainer` (alapból nem kap classNevet), ami a grid-cella hibás min-content méretezése miatt nem tudott zsugorodni. Globális, de biztonságos szabály – a kódbázisban a grid mindenhol elrendezésre, nem tartalom-alapú méretezésre szolgál, a tényleges görgetést a meglévő `overflow-x-auto` konténerek kezelik.
- [x] **`components/SeasonComparison.tsx`** – mind a 11 AI-generált / manuálisan beillesztett szöveges riport blokkra (pregame/postgame GPT-szöveg, játékos/csapat narratívák, manuális beillesztések, tooltip) `break-words` hozzáadva – egy hosszú, szóköz nélküli token (markdown táblázat, kötőjeles felsorolás) az `overflow-wrap` hiányában szintén tudta volna szélesíteni az oldalt. Másodlagos védelem a fő ok mellett.
- [x] `npx tsc --noEmit` tiszta mindkét körben; felhasználó böngészőben újratesztelte, megerősítve javítva.
- [x] **Nyitott, e sprintben nem javított**: ugyanez a `.grid > *` minta más oldalakon (pl. Áttekintés, Játékosok) elvileg is előfordulhatott korábban kisebb mértékben – nem volt jelzett panasz rájuk, de a globális szabály ott is érvényesül mostantól.

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

**6. `games` szezonkeveredés – a 2024/2025-ös meccsek duplán, 2025/2026-os `season_id`-vel is szerepelnek**

A mobil app adatrétegének építése közben derült ki (2026-09-01), éles adaton ellenőrizve. **Nem mobil-specifikus: a webes játékoslistát és szezonátlagokat ugyanígy érinti.**

**A lelet:** a `games` táblában a 2025/2026-os `season_id` alatt **723 sor** van, amiből **276 sor 2025-08-01 előtti dátumú**, azaz valójában a 2024/2025-ös szezoné. **14 csapatot** érint, nem csak az ASE-t. ASE-re bontva: 58 sor = 19 régi + 39 valódi 2025/26-os meccs. A 19 régi sor a 2024/2025-ös szezonban **is** megvan, **külön `id`-vel, de azonos dátummal, ellenféllel és eredménnyel** (pl. `2024-09-27 Endo Plus Service-Honvéd 91-60`, `2024-10-04 Alba Fehérvár 92-85`) – tehát duplikált import rossz `season_id`-vel, nem elírt szezoncímke.

**Miért fáj:** a duplikált meccsekhez **statisztika is tartozik** a `player_game_stats_2025_2026` táblában (187 sor az ASE 19 régi meccsén), így a `player_season_stats_by_season` view két szezont összegez. Konkrétan Benke Szilárd 2025/2026-ra `games_played: 50` és `total_points: 752`, ami pontosan a valódi 37 meccs / 493 pont **plusz** a 2024/25-ből átszivárgott 13 meccs / 259 pont. Az így kijövő 15.0 PPG helyett a valós érték 13.3 PPG – a hiba minden szezonátlagon (PPG/RPG/APG/perc/TS%/eFG%) végigmegy, és a csapat KPI-okon is (`useGameData` a `games` sorokból átlagol).

**Teendő:**
1. Azonosítani a duplikátumokat (`date` + `opponent` + `our_team_id` egyezés két szezon között), és eldönteni, melyik `id` a megtartandó – a 2024/2025-ös sorok tűnnek helyesnek, azok dátumtartománya konzisztens (2024-09-27 … 2025-04-12, egyetlen kilógó sor nélkül).
2. Törölni a rossz `season_id`-vel felvett sorokat **és** a hozzájuk tartozó `player_game_stats_2025_2026` sorokat (FK/cascade viselkedést előbb ellenőrizni), majd újraszámolni/ellenőrizni a `player_season_stats_by_season` view kimenetét.
3. Megkeresni, mi hozta létre őket – valószínűsíthetően egy import/scraper futás az új szezon slugjával a régi menetrenden (`HUNBASKET_SEASON_SLUG` / `KOSARSTAT_SEASON_NAME` repo variable átállítása körül). Amíg ez nincs meg, a javítás után újra megismétlődhet. Érdemes hozzá egy védelem: a `games.date` essen a `seasons.start_date`–`end_date` közé, vagy legalább egy unique constraint `(season_id, date, our_team_id, opponent)` hármasra.

**Addig:** a mobil app csak olvas, tehát a kevert listát mutatja – lásd `asestatMobile/docs/feature-tasks.md` munkanapló (2026-08-31 `useGameData`, 2026-09-01 `usePlayerData`).

---

## Backlog (later)

### UX átstrukturálás – AppShell alapja kész, finomítások később

Az **AppShell (Sidebar + Topbar) bevezetése megtörtént** (lásd fent, 2026-07-19-es lezárt sprint) a `Sidebar Nav.html` mockup alapján. A `Command Center.html` mockup elemei (live scoreboard, AI insights stream, PER/BPM/VORP ranglista, ⌘K kereső) vízió-jellegűek voltak, nincs mögöttük adatforrás – ezek **nem** kerültek be, és csak akkor relevánsak, ha a mögöttes funkció (élő adat, AI stream) külön döntés nyomán megépül.

- **Topbar globális kereső (⌘K)** – Játékos / csapat / meccs cross-view kereső. Új funkcionalitás, nincs API mögötte.
- **Topbar akciógombok** – Riasztások (notification harang), letöltés, megosztás. Új funkcionalitás mindhárom, nincs API mögötte.
- **Sync státusz indikátor** – „SZINKRONIZÁLVA · X perce" típusú jelzés a Topbarban, mögötte tényleges adatfrissítési időbélyeg-tracking (jelenleg nincs ilyen metaadat tárolva).
- **Sidebar nav-item numerikus meta badge-ek** (pl. játékosszám, meccsszám) és `⌘1..9` gyorsbillentyűk az egyes nav-itemekhez – a mockupban megvan, a jelenlegi sprintben tudatosan kihagyva a scope szűkítése miatt.
- **Mobil viselkedés finomítása** – a sidebar jelenleg CSS-media-query-vel alsó fix navsávvá alakul (nem overlay-menüvé); ha ez nem megfelelő UX nagyobb admin listáknál, felülvizsgálandó. A `3xl`/`4xl` breakpointok kihasználása nagy képernyőkön még nem történt meg. **A fogyasztói mobil élményt a külön iOS Expo app oldja meg** (lásd „Aktív sprint – Mobil (iOS) Expo alkalmazás"); a webes media query az admin/import nézetekhez marad.

### Dokumentációs eltérések

A mobil felderítés során derült ki, hogy két doksi elavult tokeneket ír le. Ez félreviheti a jövőbeli munkát, mert az `app/globals.css` a valódi Single Source of Truth.

- [x] **`context/ui-context.md` teljes újraírása ✓ (2026-08-30)** – a régi verzió **Geist Sans/Geist Mono** fontokat, **OKLCH** shadcn változókat, `--radius: 0.625rem`-et és a megszűnt `container mx-auto` + `bg-slate-900` header mintát írta le. Az új verzió közvetlenül a `globals.css`-ből (soronként ellenőrizve) dokumentálja: a teljes token-készletet, a `@theme inline` utility-leképezést, a shadcn `data-slot` override-okat, a 7 badge variánst, a `StatCard` és `DataTable` props API-t, a DataTable CSS réteg összes osztályát, az AppShell/Sidebar szerkezetet a két `min-width: 0` overflow-fixszel, a mobil media queryt, a 7 animációt és a 6 egyedi utility osztályt. Új záró szakasz: **„Ami NEM létezik – gyakori félreértések"** (`tailwind.config.ts`, `.card` osztály, Geist fontok, OKLCH, light mode, PWA manifest).
- [x] **`CLAUDE.md` javítása ✓ (2026-09-01)** – hat eltérés javítva, mindegyik a valós forrással szemben ellenőrizve:
  1. **Szín-tokenek**: `--text-secondary` `#5A7A99` → **`#7A9ABB`**, `--text-muted` `#2D4A6B` → **`#4A6D95`** (a `globals.css` értékei; a világosabb árnyalatok szándékos olvashatósági döntés a „Design konzisztencia" sprintből).
  2. **`tailwind.config.ts` törölve a mappastruktúrából** – a fájl nem létezik a repóban.
  3. **„CSS-first konfiguráció" bullet átírva** – nincs `tailwind.config.ts`, és **`3xl`/`4xl` breakpointok sincsenek**; a beépített `sm`–`2xl` skála érvényes.
  4. **Animációs példa javítva** – a `.card` osztály **nem létezik** a `globals.css`-ben; a példa most shadcn `<Card>`-ot használ. Az `as any` (amit a CLAUDE.md saját szabálya tilt) lecserélve a kódbázis valós idiómájára: `as unknown as string` (`app/page.tsx:174`), hivatkozással a `stat-card.tsx` `as React.CSSProperties` mintájára.
  5. **API auth szakasz javítva** – a doksi `requireAuth()`-ot állított, de **mind a 14 route `requireAdmin()`-t futtat** (RBAC sprint óta); a `requireAuth` megmaradt, de jelenleg **holt kód**. Új megjegyzés arról, hogy a riportok *olvasása* nem API route-on, hanem közvetlen Supabase `SELECT`-tel megy.
  6. **2 hiányzó API route pótolva** a fastruktúrában: `player-text-report/`, `save-manual-report/` (12 helyett a valós 14).

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
