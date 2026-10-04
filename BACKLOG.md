# BACKLOG.md – ASEStats Projekt

_Utoljára frissítve: 2026-10-04 (H14 – csapat szezon export: negyedprofil, ötösök / on-off, liga-összehasonlítás; import szezon-védelem)_

---

## Munkafolyamat – Web → mobil szinkron jegyzetek

- [x] **CLAUDE.md „Mobil app szinkron” szakasz (2026-09-23)** – ha egy művelet funkcionálisan, adatbázis-szinten, `@core` modulon, auth/API-n vagy scrapingen keresztül a mobil appot (`asestatmobile`) is érinti, kötelező egy `mobile-sync/YYYY-MM-DD-<slug>.md` követő jegyzet (sablon a CLAUDE.md-ben, `NYITOTT` → `ÁTVEZETVE` állapottal), ugyanabban a commitban.
- [x] **Post-game elemzés specifikáció a mobilnak (2026-09-26)** – `mobile-sync/2026-09-26-postgame-analysis-spec.md`: a számított post-game nézet (`analyzePostGameReport`) bemenetei (box score → `TeamGameStat`/`PlayerGameStat`, ellenfél-meccs párosítás, liga-benchmark, Hunbasket shot-context, opcionális pregame X-faktor), szekciónkénti megjelenítés v1/v2 bontásban, formázási szabályok. Webes kódváltozás nincs, a `@core` már szinkronban.
- [ ] **Mobil átvezetés** – post-game elemzés nézet a mobilban (a jegyzet szerint)
- [x] **Post-game kosarstat-kiegészítés a `@core`-ban (2026-09-26)** – a `SeasonComparison.tsx` negyed-trend / kosarstat eFG·TO%·ORB% / clutch / TO-típus szabályai és a `mergeUnique` összefűzés átkerült a `lib/postgame-report.ts`-be (`buildKosarstatPostgameContext`, `mergeKosarstatPostgameContext`, `KosarstatQuarterStatRow`, `KosarstatTeamMetricRow`, `PostgameClutchInput`). Webes viselkedés változatlan; a lineup-elemzés webes maradt. Mobil jegyzet: `mobile-sync/2026-09-26-postgame-kosarstat-core.md`
- [ ] **Mobil átvezetés** – `npm run sync:core` + kosarstat-kontextus a mobil post-game hookban (`mobile-sync/2026-09-26-postgame-kosarstat-core.md`)
- [x] **Nyitott jegyzetek átadása a mobil repónak (2026-10-04)** – a 9 `NYITOTT` jegyzet (5 db 2026-10-04-i H14: pontforrások, büntető-címke / ellenfélprofil, `TeamGame` szakasz-mezők, szakasz-besorolás, 2025/2026 takarítás; 4 db korábbi: játékosnév-javítás, `is_primary`, dobástérkép dedup, Kosarstat link) egyetlen önálló munkalistában: `asestatmobile/docs/2026-10-04-mobil-teendok-osszesito.md` (végrehajtási sorrend, lekérdezés-minták, ellenőrző számok, a mobil kód mostani állapotával összevetve). A webes jegyzetek nem változtak, külön fájlonkénti másolat nem készült.
- [ ] **Mobil átvezetés** – a fenti összesítő feldolgozása a mobil repóban; utána a 9 jegyzet `Állapot` sora `ÁTVEZETVE`, és a `CLAUDE.md` `@core` listájába felvenni a `kosarstat-pbp-parse` (és a mobilban már tükrözött `player-movements`) modult

---

## Aktív sprint – Mobil (iOS) Expo alkalmazás

**S1 – Tervdokumentáció ✓ (2026-08-30)**

Felhasználói döntések: **Expo / React Native** (nem PWA, nem Capacitor, nem natív Swift) · **fogyasztói nézetek** scope (az import/admin tabok desktop-only maradnak) · **vizuális AI design promptok** · **NativeWind v4** styling · **victory-native XL (Skia)** chartok · az Elemzés tabon **riportok + számított elemzések**.

- [x] **`context/mobile/mobile-overview.md`** – termékdefiníció, miért nem elég a reszponzív web (7 konkrét blokkoló felsorolva), a 8 fogyasztói nézet scope-ja, az „Elemzés" tab pontos határa, iOS információs architektúra: **8 web tab → 5 iOS tab** (Ma / Játékosok / Meccsek / Tabella / Elemzés), tudatos funkcionális eltérések a webtől.
- [x] **`context/mobile/mobile-architecture.md`** – izolált `mobile/` Expo projekt npm workspace **nélkül** (indoklással: hoisting-ütközés a web React 19 és az Expo pinnelt React-je között + 30+ fájl mozgatása); Metro `watchFolders` + `extraNodeModules` `@core` alias a gyökér `lib/`-re; RN Supabase kliens AsyncStorage adapterrel; lusta betöltési stratégia.
- [x] **`context/mobile/mobile-ui-context.md`** – teljes token-híd a `globals.css`-ből szó szerint; **új mobil tokenek** (44pt tap target, pt-alapú típusskála, 4pt spacing rács); glow **rétegzéssel**, nem shadow-val (RN korlát); hover → pressed leképezés; StatCard → **StatTile**, DataTable → **StackedRow + StatMatrix** (fagyasztott első oszlop).
- [x] **`context/mobile/mobile-design-prompts.md`** – **16 prompt** (P0 style tile + P1–P15 képernyők), közös `DS-BLOKK` kontextussal, valós magyar mintaadattal, lefedettség-ellenőrző táblázattal és elfogadási checklistával.
- [x] **P15 · Igazolások (2026-09-22)** – a webes Igazolások feature mobil design promptja. Felhasználói IA-döntés: a **Tabella tab második szegmense** (TABELLA · IGAZOLÁSOK), mert mindkét nézet liga-szintű és ez az egyetlen egy-mélységű tab; a tab bar címkéje marad „Tabella", a nagy cím az aktív szegmenst követi. A prompt mintaadata a `league_player_team_seasons` valós 2025/26 → 2026/27 keretkülönbségéből számolt (ASE: 4 érkező / 9 távozó · liga: 95 érkező / 140 távozó, 14 csapat). A `mobile-overview.md` scope- és IA-táblája ezzel együtt frissült: 9 fogyasztói nézet. **Átemelve az `asestatmobile` repóba** (2026-09-22): `docs/design-prompts.md` (P15 + DS-BLOKK) és `docs/feature-tasks.md` (S9 feladatszakasz, munkanapló, D-110 döntés) – kizárólag kiegészítésként, törlés nélkül.

**Felderítési leletek, amikre a terv épül:**

- **A `lib/` elemző mag bizonyítottan tiszta** – 15 modul (~9 500 sor: `stat-formulas`, `positions`, `terminology`, `style-vocabulary`, `dashboard-types`, `player-stat-mapping`, `season-tables`, `fetch-all-rows`, `situational-analysis`, `kosarstat-clutch-parse`, `postgame-report`, `player-analysis`, `player-postgame`, `pregame-scouting`, `team-analysis`) **nulla külső importtal** – se React, se Next, se DOM, se Supabase. Módosítás nélkül futtatható RN alatt. (A `situational-analysis.ts` naiv DOM-grepen fals pozitívot ad: a 260. sorban `window` nevű **lokális** változó van.)
- **Az AI riportok olvasása nem igényel API route-ot** – a kliens közvetlen `supabase.from('game_text_reports' | 'team_text_reports' | 'player_text_reports')` SELECT-tel olvas. Mind a 14 `app/api/*` route `requireAdmin`-t futtat és mutáló → a fogyasztói scope-on kívül.

> **ELAVULT SZAKASZ (2026-09-22).** Az alábbi „még nem indult" lista a 2026-08-30-i
> állapotot tükrözi. A mobil implementáció azóta **külön repóban fut**:
> `/Users/kacsorzsolt/Developer/Projektek/asestatmobile` (S3–S8 kész, élő
> mérkőzés-követésig; saját `docs/feature-tasks.md` munkanaplóval és
> döntésnaplóval). Ez a szakasz historikus, a mobil aktuális állapotát a másik
> repo backlogja mondja meg.

**Következő lépések (a 2026-08-30-i terv szerint):**

- [ ] **S2 – Vizuális validáció (felhasználói lépés)**: P0, majd P2 és P8 lefuttatása a választott eszközben. Ha a design nyelv nem áll össze, a `mobile-ui-context.md` módosul, és csak utána megy a maradék 11 prompt.
- [ ] **S3 – Expo váz**: `mobile/` létrehozása, Metro/tsconfig alias, NativeWind config a tokenekkel, `expo-font`, Supabase kliens, auth + login. **Első feladat: `@core/stat-formulas` import füstteszt** – ha a Metro alias nem működik, fallback az npm workspace-re promotálás.
- [ ] **S4 – Adatréteg**: `useFilterData`/`useGameData` port lusta betöltéssel, szűrő perzisztálás AsyncStorage-ban.
- [ ] **S5+ – Képernyők** prioritási sorrendben: Ma → Meccsek → Játékosok → Tabella → Elemzés.
- [ ] **Új npm csomagok jóváhagyása S3 előtt** (pontos verziókkal): `expo`, `expo-router`, `expo-font`, `nativewind`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `victory-native`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`, `lucide-react-native`.

---

## Aktív sprint – Élő mérkőzés-gyűjtő (backend a mobil app "élő meccs" nézetéhez)

A mobil app (`asestatmobile`, külön repó) kapott egy "élő mérkőzés" funkciót:
a Ma képernyőn egy élő kártya + egy teljes élő nézet (állás, negyedek, box
score), ha a kiválasztott csapatnak éppen fut a meccse. A mobil oldali kód
(típusok, polling hook, UI) kész és commitolva a mobil repóban. Ez a
sprint a **backend** felét fedi: séma + gyűjtő, ami az adatot betölti.

**Felderítési lelet, amire a terv épül:** az MKOSZ `hunbasket.hu/elo` oldala
minden élő mérkőzéshez linkeli a `netcasting*.webpont.com` élő jegyzőkönyvet
(`class="live-game"` link). A netcasting kliens **JSON-t** ad
(`storage/full<kód>.html`, három string-cserével dekódolható, nem kell
Playwright/DOM-parse). A kliens saját `js/1.n6.js` fájljában (letöltve és
átvizsgálva) megtaláltuk a **pontos** esemény-kód → statisztika leképezést
(`filmCode2Text.hun` szótár + `addEvent()` switch + `alkodok` pontérték-térkép
+ `getTimeStrFromGT()` óra-képlet) – ez alapján valódi box score építhető a
play-by-play eseményekből, nem csak állás. Részletek: `HOWTO-live-scan.md`.

- [x] `migrations/add-live-match-tables.sql` – `live_games` (egy sor/meccs, nem
  csapatperspektíva), `live_player_lines` (box score), `live_quarter_scores`
  (negyedbontás); RLS: authenticated SELECT, írás csak service_role
- [x] `supabase/functions/live-scan/index.ts` – Deno Edge Function: `/elo`
  parse → netcasting JSON fetch+decode → csapat-feloldás (`teams`, névdrift-
  védelemmel, nem hoz létre új sort) → box score + negyedek aggregálása a
  play-by-play eseményekből → upsert; lezárt/eltűnt meccsek `final`-ra
  váltása; 6 órás retention törlés
- [x] `supabase/functions/_shared/stat-formulas.ts`,
  `supabase/functions/_shared/team-match.ts` – Deno-kompatibilis másolatok
  (`lib/stat-formulas.ts` valuation képlete, `scrape-utils.ts` szigorú
  csapatnév-egyezés) – a Deno futásidő nem tudja közvetlenül importálni a
  Next.js `lib/`-et
- [x] `HOWTO-live-scan.md` – deploy, `pg_cron`+`pg_net` ütemezés, a forrásból
  bizonyítottan tudott vs. élő meccsen validálandó pontok listája
- [x] **Migráció lefuttatása ✓ (ellenőrizve 2026-09-21)** – a `live_games`,
  `live_player_lines` és `live_quarter_scores` tábla mind létezik az éles
  adatbázisban (jelenleg 0 sor, a szezon még nem indult).
- [x] **`pg_cron`/`pg_net` extension ✓ (ellenőrizve 2026-09-21)** – mindkettő
  telepítve: `pg_cron` 1.6 (`pg_catalog`), `pg_net` 0.14.0 (`extensions`).
  Nem blokkolja az ütemezést.
- [x] **Edge Function deploy** – 2026-09-04, `supabase functions deploy
  live-scan --use-api` (Management API bundle, **nem** Docker; a `--use-api`
  megkerüli a lokális Docker-igényt a régi CLI-n is). Projekt linkelve:
  `iipcpjczjjkwwifwzmut`. Verify_jwt = true (alapértelmezett).
- [ ] **`pg_cron` job létrehozása** a Supabase SQL Editorban (HOWTO 3. pont)
  – **2026-09-21: a `cron.job` tábla ÜRES, egyetlen ütemezés sincs.** Az Edge
  Function deployolva és aktív (`live-scan`, v4), az extensionök megvannak, a
  táblák megvannak – ez az egyetlen hiányzó láncszem az élő gyűjtéshez. Az első
  bajnoki 2026-09-25, tehát ezt addig létre kell hozni.
- [ ] **Éles validáció** az első 2026/27-es bajnokin (2026-09-25, a szezon
  ekkor indul) – lásd `HOWTO-live-scan.md` 5. pontja: `/elo` szerkezet, óra
  viselkedése, csapatnév-egyezés

- [x] **Csapatszintű meccsstatisztika – kód (2026-09-26)** – a gyűjtő eddig
  csak játékos sorokat és negyedeket írt, a meccs (csapat) statisztikát nem.
  Felhasználói döntés: új `live_team_stats` tábla (egy sor/meccs/oldal), a
  netcasting „Statisztikák" panel tartalmával (dobások, támadó/védő
  lepattanó, assist, szerzett/eladott labda, blokk, fault, kiharcolt fault,
  időkérés, VAL). A csapatszintű eseményeket (2002–2007, 2020, 2011) is
  számolja, amiket a játékos sorok nem tartalmaznak. `migrations/add-live-team-stats-table.sql`
  + `live-scan/index.ts` `aggregateTeamStats()`/`upsertTeamStats()`. A
  2026-09-25-i Alba–Körmend meccsen ellenőrizve (96–77 egyezik).
- [ ] **`live_team_stats` migráció futtatása** az SQL Editorban (kézi lépés)
- [ ] **`live-scan` újradeployolása** (`supabase functions deploy live-scan --use-api`)
  – CSAK a migráció után, különben a futó meccsek `final`-ra ugranak
- [ ] **Mobil átvezetés** – `mobile-sync/2026-09-26-live-team-stats.md`

**Tudatosan v1-en kívül hagyva** (dokumentálva a HOWTO-ban, nem elfelejtve):
percek (`minutes`) számítása csereesemény-párosításból (v1: mindig 0),
`'halftime'` státusz explicit felismerése (v1: csak `'live'`/`'final'`),
`player_id` feloldás a `players` táblára (v1: mindig `NULL`, a forrás
névalakja túl bizonytalan az automatikus párosításhoz).

---

## Aktív sprint – Bajnokság-szintű játékosmozgás nyomonkövetés

Új feature (nem a stílus sprint része): az egész NB I/A bajnokság
játékosmozgásának vizuális nyomonkövetése csapatonként – ki érkezett, ki
távozott, hazai csapatváltás vagy külföld irányába/onnan. Felhasználói
scope-döntések: utolsó 3-4 szezon, csak a jelenlegi élvonal (~14 csapat, a
meglévő `teams` tábla), önálló 13. nav item az `AppSidebar.tsx`-ben.

**Jóváhagyott adatforrás:** a Kosarstat szezonos csapatoldalai
(`teams/team/boxstats/?team=<ID>&season=<kód>`), stabil opak player-ID-vel.
A 2026-09-21-i élő ellenőrzés bizonyította, hogy a csapatarchívum első/utolsó
éve nem folytonos stint; a felhasználó ezért jóváhagyta a pontos szezonos
névsorra váltást. A külföldi célklubot/országot a forrás nem bizonyítja.
Használat és élesítés: `HOWTO-player-movements.md`.

- [x] `migrations/add-league-player-movements-tables.sql` – `kosarstat_team_map`
  (kosarstat csapat-ID → `teams.id`, önjavító fuzzy match-csel töltve),
  `league_players` (stabil kosarstat player-ID törzsadat), `league_player_team_seasons`
  (játékos–csapat–szezon tényadat); RLS: authenticated SELECT, írás csak service_role
- [x] **Alaptáblák és RLS ellenőrizve (2026-09-21)** – a három tábla elérhető; a szezonos import feltöltötte. READ ONLY tranzakcióban az `authenticated` szerep a besorolás SELECT-jével 726 mozgást lát, az `anon` szerep 0 tagságot. Ebben a munkamenetben éles migrációt nem futtattunk.
- [x] **Szezonos scraper és éles import ✓ (2026-09-21)** – `scrape-kosarstat-team-players.ts`
  + `lib/kosarstat-movement-source.ts`: pontos `boxstats` keretek; teljes
  DataTables-adat; a legújabb menetrend 14 csapata; forrásból olvasott
  klubnév-aliasok (DEAC=119, OSE=155), kézi map elsőbbséggel. A teljes
  forrásellenőrzés írás előtt történik, hiba nem ad sikeres kilépési kódot.
  Éles eredmény: **14 csapat, 473 játékos, 847 játékos-szezon sor**, 2023/24–2026/27.
  Négy parser-regresszióteszt sikeres. Az U23 nem bizonyít hazai/légiós státuszt,
  ezért NULL; születési évet a pontatlan szezonos életkorból nem számolunk.
  Írás nélküli ellenőrzés: `KOSARSTAT_MOVEMENT_DRY_RUN=1 npm run kosarstat:team-players`.
- [x] `migrations/add-league-player-movements-view.sql` – `league_player_movements`
  VIEW (`LAG`/`LEAD` ablakfüggvények szezononként/játékosonként: érkezett/távozott,
  hazai célcsapat vagy ismeretlen, kihagyás utáni visszatérés). READ ONLY PostgreSQL-teszttel ellenőrizve:
  hazai váltás, visszatérés, több csapat/szezon, folyamatos tagság, időablakhatárok.
  Valós ASE-példák: Yasiin Joseph Alba → ASE; Jay Jay Chandler egy kihagyott
  szezon után visszatér. `security_invoker` + authenticated SELECT.
- [ ] **View-migráció kézi futtatása** a Supabase SQL Editorban:
  `migrations/add-league-player-movements-view.sql`. A teszt csak a SELECT-et
  futtatta, a view-t nem hozta létre.
- [x] `app/api/kosarstat-team-players-import/route.ts` (npm script már kész:
  `kosarstat:team-players`) + `components/LeaguePlayerMovementsImport.tsx`
  az admin Import tabba

- [x] `hooks/usePlayerMovements.ts` + `components/LeaguePlayerMovements.tsx`
  – öt StatCard, csapatonkénti érkező/távozó DataTable, profil-linkek;
  szezon/csapat szerint szűrt és lapozott olvasás, válaszvalidáció, késői
  válaszok eldobása, loading/error/empty állapot és újrapróbálás.
  Új **Igazolások** nav item; ezen a tabon a globális csapatszűrőben
  **Összes követett csapat** opció is elérhető.
- [x] **Lokális ellenőrzések** – parser- és válaszvalidációs tesztek;
  SQL READ ONLY tesztek valós és szintetikus adatokkal; böngészőben valódi
  SELECT-eredményt helyettesítő HTTP-válaszokkal: ASE 4 érkező/9 távozó,
  14 csapatos liganézet, szűrőváltási verseny, hibás/üres adatforrás,
  olvasói jogosultság, mobil overflow és sidebar perzisztencia. Konzolkivétel: 0.
  Lint: 0 error, 7 korábbi warning. A Deno–Next tsconfig-ütközés javítva
  (lásd Hotfixek / H4): `npm run build` végigfut, `npm run lint` 0 error.
- [ ] **Éles view/RLS és dashboard ellenőrzés** a kézi view-migráció után.
  **2026-09-21: megerősítve, hogy a migráció még NEM futott le** – a
  `league_player_movements` view nem létezik az éles adatbázisban
  (`relation "public.league_player_movements" does not exist`), így az
  Igazolások tab jelenleg hibára fut. Az előfeltételek megvannak: a
  `league_player_team_seasons` mind a 6 szükséges oszlopot tartalmazza, és
  4 egymást követő szezonra van keretadat (2023/24: 222, 2024/25: 204,
  2025/26: 233, 2026/27: 188 tagság). Teendő: a
  `migrations/add-league-player-movements-view.sql` lefuttatása a Supabase
  SQL Editorban. **2026-09-22: újra ellenőrizve, változatlan** – az adatimport
  sikeres (473 `league_players`, 847 `league_player_team_seasons` sor), de a
  view sem service role, sem anon kulccsal nem érhető el (42P01), tehát a
  migráció továbbra is futtatásra vár.

**Tudatosan v1-en kívül hagyva** (döntés dokumentálva, nem hiányosság):
egyedi kosarstat player-profil oldalak bejárása (a szezonos csapatoldalakat
használjuk, a `profile_url` mezőben mentjük a linket
kézi ellenőrzéshez); szezonon belüli (mid-season) átigazolás tiszta
elkülönítése a `LAG`/`LEAD` modellben; automatikus cron-be kötés
(`.github/workflows/scrape.yml`) – külön döntés, nem automatikus.

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

**H4 – `npm run build` elszáll a Supabase Edge Function Deno-importján ✓ (2026-09-21)**

Tünet: a fordítás sikeres, de a `Running TypeScript` lépés megáll:
`./supabase/functions/live-scan/index.ts:36 – Cannot find module 'npm:@supabase/supabase-js@2' or its corresponding type declarations.`

Ok: a `supabase/functions/` alatti kód **Deno** runtime-ra készült (`npm:` és `.ts`
kiterjesztésű importok), a `tsconfig.json` `include` viszont `**/*.ts`-sel a teljes
repót behúzta, így a Next.js build a Deno-fájlokat Node-modulfeloldással
típusellenőrizte. Csomagtelepítéssel nem oldható meg: az Edge Function nem is a
Next.js bundle része.

- [x] **`tsconfig.json` – `exclude` bővítve `"supabase/functions"`-nel.** Csak az
  `exclude` tömb változott; a `compilerOptions` (köztük a `strict: true`) érintetlen,
  az app- és scraper-kód típusellenőrzése változatlan szigorúságú.
- [x] **Ellenőrzés**: `npm run build` végigfut (Compiled successfully + TypeScript
  check + 16 route), `npm run lint` 0 error / 7 korábbi warning.

---

**H5 – Az import scriptek működőképességének ellenőrzése + tabella-duplikáció ✓ (2026-09-21)**

Teljes körű teszt mind a 9 CLI import scriptre és a hozzájuk tartozó API
route-okra, három rétegben: statikus ellenőrzés → élő forrásproba írás nélkül →
szűkített hatókörű éles futtatás előtte/utána sorszám-diffel.

- [x] **Statikus réteg** – `npx tsc --noEmit` 0 hiba, `npx eslint` 0 error
  (7 korábbi warning). A 6 route-ból hivatkozott script mind létezik; a
  `lib/run-script.ts` spawn wrapper és a `hunbasket-round-import` env-átadása
  (12 `HUNBASKET_*` változó) helyes.
- [x] **Olvasó forrásproba (12/12 OK)** – a scriptek pontos szelektoraival, éles
  oldalakon, DB-írás nélkül: hunbasket menetrend x2526 és x2627 (182–182 sor),
  box-score meccslinkek + játékostábla (2 tábla, 23 sor, >=32 oszlop), tabella,
  `ajax/film.php` dobástérkép (118 esemény), kosarstat `season_games` és a meccs
  aloldalai, valamint a valós `parseSeasonPlayers` egy szezonos kereten.
  **Mind a 14 csapatnév feloldható** a `teams` tábla ellen mindkét szezonban –
  a H3-ban bevezetett `TEAM_NAME_ALIASES` élesben is működik
  (`"Endo Plus Service-Honvéd" -> "Budapesti Honvéd Sportegyesület"`).
- [x] **Éles futtatás szűkített hatókörrel** – `hunbasket:fixtures` (182 upsert),
  `hunbasket:standings`, `hunbasket:import` (`HUNBASKET_ROUND_FILTER=1`, 7 meccs),
  `hunbasket:rosters` (1 csapat, 13 frissítve), `kosarstat:pbp`
  (`KOSARSTAT_GAME_LIMIT=1`, 9 oldal), `kosarstat:team-players` (1 csapat, dry-run
  és élesben is), `hunbasket:shotchart:assign` (359 meccs, 45 168 esemény, 0 hiba),
  `kosarstat:backfill-links` (**353 új linkelés**, 24 nem párosítható, 0 ütközés).
  A `hunbasket:shotchart` teljes futása maradt el (nincs benne limit opció), de az
  írási útvonala a box-score importon keresztül lefedett
  (`Dobasterkep mentve: 133–147 event` meccsenként).
- [x] **Sorszám-diff** – 16 táblából 14 változatlan. `players` +2 (két új
  játékossor a 2025/26-os 1. fordulóból; névsorrend-független duplikátum-ellenőrzés
  a szezon 412 játékosán: **0 találat**). `player_game_stats_2025_2026` −14: a
  parser szándékosan kihagyja a 0 perces (DNP) sorokat
  (`scrape-hunbasket.ts`: `minutes === 0` → `continue`), az újraimport tehát
  eldobta az 1. forduló 14 legacy DNP sorát. Nem adatvesztés, de a szezonban
  **maradt 48 ilyen legacy 0 perces sor 21 meccsen** – ezek egy korábbi import
  útvonalról származnak, és csak újraimportáláskor tűnnek el.

**A talált valódi hiba – tabella-duplikáció:**

A hunbasket tabella oldal ugyanazt a 14 csapatsort **kétszer** rendereli egyetlen
`<table>`-ben (asztali + mobil változat), így a `table tbody tr` szelektor 28 sort
ad. A `scrape-hunbasket-standings.ts` dedup nélkül mentette mind a 28-at a
`standings.data` JSON tömbbe, a `StandingsView` pedig nem deduplikál
(`getRowId={(r) => r.position}`), tehát a tabella nézet duplán listázta a csapatokat.

- [x] **`scrape-hunbasket-standings.ts` – `dedupeByPosition()`** a parse után:
  pozíció szerint deduplikál, az első előfordulás nyer, és logolja az eldobott
  sorokat. Ha ugyanaz a pozíció **más** csapattal jön elő, az nem a kétszeres
  renderelés, hanem szerkezetváltozás → **írás előtt kivételt dob** (a H3-ban
  bevezetett „üres/hibás forrás = hiba" elv folytatása).
- [x] **`archive/fix-standings-duplicates.ts`** – egyszeri adattisztító a korábban
  mentett rekordokhoz, alapból dry-run (`STANDINGS_FIX_APPLY=1` az íráshoz).
  Lefuttatva: a 16 `standings` rekordból 2 volt duplikált (28 sor), javítva.
  Ellenőrzés után mind a 16 rekord 14 soros.
- [x] **Ellenőrzés**: a javított script újrafuttatva →
  `Duplikált tabellasorok eldobva: 28 → 14`, `Tabella import kész: 14 csapat`.
  `npm run build` és `npx eslint` tiszta.

**A megfigyelésekből elvégzett munka ✓ (2026-09-21):**

1. [x] **`hunbasket:shotchart` szűrők** – a menetrend-szűrés (forduló / dátum /
   csapat) a negyedik duplikálás helyett a `scrape-utils.ts`-be került
   (`parseRoundFilter`, `matchesRound`, `matchesStage`, `matchesDateRange`,
   `parseTeamFilter`, `matchesTeamFilter`), a `scrape-hunbasket.ts` a lokális
   másolatai helyett ezeket használja, a dobástérkép-import pedig megkapta
   ugyanazt a szintaxist + `HUNBASKET_SHOT_GAME_LIMIT`-et. 19 helper-teszt zöld,
   szűrt futás: 182 → 7 → 2 meccs. A szöveges kör illesztése most mindkét oldalon
   `normalizeName`-mel megy, így a többszörös szóköz sem akadály.
2. [x] **`kosarstat:backfill-links` a rendszeres futásban** – `scrape.yml` 10.
   lépése, a pbp után, `--season` szűkítéssel. Idempotens (újrafuttatva 0 új
   link, 384 már linkelt).
3. [x] **Legacy adatminőség rendbe téve** – lásd a következő szakaszt.

### Legacy adattisztítás ✓ (2026-09-21)

A „kevert csapat-hozzárendelésű" sorokat **nem lehetett kitörölni**: a vizsgálat
kimutatta, hogy a 19 érintett meccsből csak **1** volt valódi duplikátum, 17-nél
részleges az átfedés, 1-nél pedig az adat **csak ott volt meg**. A tömeges törlés
valós box-score adatot semmisített volna meg.

Helyette a **validált box-score script újrafuttatása** végezte el a javítást: az
per meccs töröl+beszúr, tehát a hibás sorokat kiseperi és a helyeseket újraírja.

- [x] **24 érintett dátum újraimportálva** (`HUNBASKET_DATE_FROM/TO` szűkítéssel,
  2025-10-03 – 2026-02-22): 168 meccs-sor újraírva, **0 hiba**.
  Eredmény 2025/2026-ban: kevert csapat-hozzárendelés **26 meccs → 0**,
  üres DNP sorok **48 → 9**.
- [x] **`archive/fix-misdated-duplicate-games.ts`** – az újraimport után 3 olyan
  `games` sor maradt, amelynek **dátuma nem szerepel a menetrendben**, ezért a
  szűrt import el sem érte; a stat soraik teljes egészében az ELLENFÉL keretéhez
  tartoztak. Keletkezés: a menetrendben azóta javított dátum miatt az újraimport
  a `games` UNIQUE (season_id, our_team_id, date) kulcs mellett új sort hozott
  létre, a régi ottmaradt. Mindhárom mérkőzés helyes dátum alatt, helyes kerettel
  megvan (2025-10-04 és 2025-11-13). A szkript 4 feltételt ellenőriz törlés előtt:
  idegen keret, **azonos eredményű** helyes megfelelő megléte (a dátum épp a
  hibás mező, ezért az eredmény azonosítja a meccset), nincs `kosarstat_game_id`
  link, és nincs AI riport. Lefuttatva: **3 sor törölve**, 0 kihagyva;
  újrafuttatva 0 törlendő.

**Nem hiba, ezért nem nyúltunk hozzá:** a 2024/2025-ös szezonban maradt 16 olyan
stat sor, ahol a játékos `players.team_id`-ja más csapatra mutat, mint a meccs
`our_team_id`-ja. Mind a 16 a **2025-01-31 / 2025-02-01** kétnapos ablakban van,
12–40 perces, pontszerző teljesítményekkel (pl. BIGELOW 34 perc / 29 pont) – ezek
**szezon közbeni átigazolások**: a `players` tábla a (season_id, team_id, név)
kulcsa miatt egy játékost szezononként egy csapathoz köt, így a váltást nem tudja
ábrázolni. Ugyanez a 2025/2026-os „Avery Jr" eset is. Ez a már **tudatosan
elhalasztott** mid-season átigazolás-modellezés kérdése (lásd az Igazolások
sprint „Tudatosan v1-en kívül hagyva" pontját), nem adathiba – a sorok törlése
valós teljesítményeket semmisítene meg.

- [ ] **`archive/fix-empty-dnp-stat-rows.ts` lefuttatása** – a maradék **9 üres
  DNP sor** (4 Magyar Kupa meccsen, amelyek nincsenek a bajnoki menetrenden,
  ezért a box-score import nem éri el őket). A szkript kész és dry-run
  ellenőrzött; csak teljesen üres sort töröl (0 perc ÉS 0 pont ÉS 0 valuation),
  bármi mást meghagy és jelez. A végrehajtást a Claude Code auto mode
  „mass delete" védelme blokkolta, ezért **kézzel futtatandó**:
  `DNP_FIX_APPLY=1 npx tsx archive/fix-empty-dnp-stat-rows.ts`

**H6 – Vercel import: `npm error ENOENT ... mkdir '/home/sbx_user…'` ✓ (2026-09-22)**

Tünet: a Vercel projekt importálásakor az `npm install` már az első csomag
(`tsx`) letöltésénél elhasalt `ENOENT: no such file or directory, mkdir
'/home/sbx_user1051'` hibával, és még a hibalogot sem tudta kiírni. Ok: az npm
a `$HOME/.npm` alá tenné a cache-t és a logot, a build-sandbox home könyvtára
viszont nem létezik / nem írható. Nem kódhiba – a `tsx` csak az ábécé szerinti
első letöltés volt, nem a kiváltó ok.

- [x] **`vercel.json`** (új) – `installCommand` a `/tmp/.npm` cache-re
  (`npm install --cache /tmp/.npm --prefer-offline --no-audit --no-fund`), a
  `/tmp` a build sandboxban mindig írható. A `buildCommand` pedig
  `NEXT_TELEMETRY_DISABLED=1 next build`, mert a Next telemetria ugyanígy a
  home könyvtárba írna. `framework: "nextjs"` explicitté téve.
- [x] **`HOWTO-vercel-deploy.md`** (új) – a hiba magyarázata, a repó oldali
  javítás, a Vercel dashboardon ellenőrizendő 4 pont (saját `HOME` /
  `NPM_CONFIG_CACHE` env változó, kézi Install Command override, build cache
  nélküli redeploy, Node 22), a kötelező env változók listája, és ami
  serverlessben eleve nem működik (a 4 spawn-alapú import route).
- [x] Ellenőrizve: az install parancs `--dry-run`-ja átmegy (lockfile szinkron),
  a `NEXT_TELEMETRY_DISABLED=1 next build` lokálisan zöld.

**Funkcionális változás nincs** – csak build/deploy konfiguráció.

---

**H7 – Keret frissítés: `duplicate key value violates unique constraint "teams_short_name_key"` ✓ (2026-09-26)**

Tünet: a `hunbasket:rosters` (2026/2027, `x2627`) a 4. csapatnál elszállt:
`Csapat létrehozási hiba (OSE Lions)`. Ok: a H3-ban a menetrend importot
fuzzy matchingre és „nincs auto-létrehozás" szabályra állítottuk, a
`scrape-hunbasket-rosters.ts` viszont maradt a szigorú
`findTeamByNameStrict` + automatikus `teams` insert kombinációnál. A 26/27-es
szponzornév-drift így új csapatot próbált felvenni, a `short_name: "OSE"` pedig
a `"MVM-OSE Lions"` sorral ütközött.

Felderítés (a tabella 14 csapata a szigorú matcher ellen): 11 találat, **3
drift** – `"OSE Lions"`, `"Falco KC Szombathely"` (ez is `short_name`
ütközésre futott volna) és `"Délút-SZTE-Szedeák"`. Utóbbi a veszélyesebb: a
`"Délút-SZTE-Szedeák"` short_name nem ütközik semmivel, így **csendben
duplikált `teams` sort** hozott volna létre, a keret egy üres új csapat alá
került volna.

- [x] **`scrape-utils.ts` – `TEAM_NAME_ALIASES` +3 bejegyzés** a meglévő
  `teams` sorokra: `ose lions → mvm-ose lions`, `delut-szte-szedeak →
  szte-szedeak`, `falco kc szombathely → falco-vulcano energia kc szombathely`.
  A közös belépési ponton old fel, így mind a 4 scraper örökli. DB-írás,
  sémamódosítás nem történt; a `teams` sorok neve változatlan.
- [x] **Ellenőrzés**: a 26/27-es tabella mind a 14 csapatneve feloldódik
  strict és fuzzy matcherrel is; duplikált `teams` sor nem keletkezett (a
  megszakadt futás az OSE-nél, írás előtt állt meg). `npx tsc --noEmit` tiszta.
- [x] **Előkészítés – alias névcsoportok (2026-09-26)**: `scrape-utils.ts`
  `findTeamByNameStrict`/`Fuzzy` az aliasokat egyenértékű névcsoportként
  kezeli (saját név elsőbbséggel, lépésenként), a párok `régi → mai` irányba
  írva. Így a matcher a `teams.name` átnevezése előtt és után is ugyanarra a
  sorra talál – nincs olyan ablak, amikor az import elszállna. Ellenőrzés: a
  régi és új matcher 28 név × 2 módon 0 eltérés; szimulált átnevezés után 0
  eltérés; `tsc` + `eslint` tiszta.
- [x] **Átnevező SQL (2026-09-26)**: `migrations/rename-teams-2026-2027-sponsor-names.sql`
  – `MVM-OSE Lions → OSE Lions`, `SZTE-Szedeák → Délút-SZTE-Szedeák`,
  `Falco-Vulcano Energia KC Szombathely → Falco KC Szombathely`; id és
  short_name marad, `games.opponent` szándékosan nem változik; egy tranzakció,
  régi-név és foglalt-név ellenőrzéssel. Mobil jegyzet:
  `mobile-sync/2026-09-26-teams-sponsor-rename.md`.
- [ ] **Kézi lépés: az átnevező SQL futtatása a Supabase SQL Editorban.**
- [x] **Döntés: igen (2026-09-26)** – a `teams.name` átírása az új szponzornevekre (mint a
  Honvédnál a H3-ban) – ez adattartalom-változás, a mobil is megjelenítené,
  ezért csak felhasználói jóváhagyással. Ha megtörténik, az aliasok iránya
  megfordul (régi név → új név). **Hatáselemzés (2026-09-26):** az igazolások
  (`league_player_movements`), a `league_fixtures` és a `players` `team_id`-vel
  kötnek, azokat nem rontja el (a régi szezonok igazolásai is az új nevet
  mutatnák). A `standings.data` a scrapelt név pillanatképe, érintetlen.
  **Törne viszont** a `hooks/useGameData.ts:151/296`: a `games.opponent`
  szöveget pontos névegyezéssel keresi a `teams`-ben (ellenfél box score
  párosítás, `opponentGameId`) – az átnevezés után a régi meccseknél nincs
  találat. Ezért az átnevezés előfeltétele a lenti hiba javítása.
- [ ] **Talált meglévő hiba (a H3-as Honvéd átnevezés mellékhatása)**:
  **69 meccs** (`games.opponent = 'Endo Plus Service-Honvéd'`, 24/25: 26,
  25/26: 43) opponent-szövegéhez nincs `teams` sor, így ezeknél az ellenfél
  meccs-párosítás (`opponentGameId`) üres. A 25/26-on belül vegyes a név
  (43 régi + 11 új). Javítási opciók, döntésre vár: (a) a hook névfeloldása
  aliasokkal, (b) a `games.opponent` adatjavítása az aktuális névre,
  (c) hosszú távon `games.opponent_team_id` oszlop (séma). Mindhárom a mobilt is
  érinti → `mobile-sync/` jegyzet kell. **Döntés (2026-09-26): (c).**
- [x] **C/1 – migráció**: `migrations/add-games-opponent-team-id.sql` – új
  nullable `games.opponent_team_id` (FK → `teams`, `ON DELETE SET NULL`) +
  index `(season_id, opponent_team_id)` + idempotens backfill (pontos név +
  a régi Honvéd név aliasa). Előzetes elemzés: mind az **1086** meccs
  feloldható (1017 pontos név + 69 alias). Mobil jegyzet:
  `mobile-sync/2026-09-26-games-opponent-team-id.md`.
- [x] **C/1 kézi lépés – migráció lefuttatva (2026-09-26)**, ellenőrizve:
  1086/1086 sor kitöltve, 0 NULL, 0 önmagára mutató; a 69 régi nevű Honvéd
  meccs a `Budapesti Honvéd Sportegyesület` sorra került.
- [x] **C/2 – írók**: `scrape-hunbasket.ts` (`opponent.id` az `ensureTeam`-ből),
  `GameQuickImport.tsx`, `JsonImport.tsx` (mindkét insert ág) tölti az
  `opponent_team_id`-t; `lib/supabase.ts` `games` típus frissítve. A
  `GamesList` szerkesztője csak a megjelenítési nevet írja (az ID marad); a
  `scripts/migrate-json-to-supabase.ts` szezon/csapat nélküli legacy szkript,
  nem módosítva. Ellenőrzés: `tsc` + `eslint` tiszta; éles
  `hunbasket:import` a 25/26-os 1. fordulón (`HUNBASKET_ROUND_FILTER=1`) –
  14 upsert, mind a 14 sor `opponent_team_id`-je egyezik a névvel. Mobil
  jegyzet: `mobile-sync/2026-09-26-games-opponent-team-id-writers.md`.
- [x] **C/3 – olvasók**: `hooks/useGameData.ts` (ellenfél-ID feloldás +
  ellenfél-meccs lekérdezés `opponent_team_id`-re), `components/TeamComparison.tsx`
  (head-to-head szűrés, mindkét `games` select), `components/JsonImport.tsx`
  (meglévő meccs kiválasztása) – név csak ID nélküli sorra fallback.
  `context/architecture.md` 11. invariáns. Ellenőrzés: `tsc` + `eslint` tiszta;
  a hook párosítási logikájának szimulációja az összes meccsen: párosított
  ellenfél-meccs 24/25 **314 → 366/366**, 25/26 **634 → 720/721**. Mobil
  jegyzet: `mobile-sync/2026-09-26-games-opponent-team-id-readers.md`.
- [x] **Szolnok duplikátum – összevonva ✓ (2026-09-26).** A `teams`-ben két sor:
  `NHSZ-Szolnoki Olajbányász` (72 saját meccs, 49 játékos) és a 2026-04-19-i
  playoff importból keletkezett `Szolnoki Olajbányász` (11 saját meccs, 13
  játékos, a 2026. ápr–máj. playoff meccsek). A 25/26 egyetlen párosítatlan
  meccse is ebből fakad.
  **Incidens (2026-09-26, a C/2 ellenőrző importja okozta):** a hunbasket a
  25/26-os 1. fordulót ma már `Szolnoki Olajbányász` néven mutatja, ez pontosan
  a duplikátum sorra illeszkedik, így a `HUNBASKET_ROUND_FILTER=1` futás a
  2025-09-27-i Szolnok–Kaposvár meccsre **duplikált `games` sort** írt a
  duplikátum csapat alá (`d32cd3d5…`, 9 stat sor), a kaposvári sor ellenfelét
  átírta rá, 1 új játékossort hozott létre (Vrabac Adin #77), és a
  `hun_122719` dobástérkép 74 szolnoki eseményét a duplikátum csapatra kötötte.
  Az eredeti NHSZ meccssor és 9 stat sora érintetlen. Javítás felhasználói
  jóváhagyásra vár (csak a mai kár visszaállítása, vagy a két csapatsor teljes
  összevonása). **Addig a 25/26 box-score újraimportja kerülendő** (a 26/27-es
  hétvégi import nem érintett: ott a tabella `NHSZ-Szolnoki Olajbányász`-t mutat).
  **Döntés (2026-09-26): teljes összevonás.** Előkészítve:
  - [x] `scrape-utils.ts` alias `szolnoki olajbanyasz → nhsz-szolnoki olajbanyasz`
    – mostantól minden import az NHSZ-sort használja (strict + fuzzy
    ellenőrizve); összevonás után ez akadályozza meg a DUP újra-létrehozását.
  - [x] Feltérképezés: DUP hivatkozások – `games` 11 saját + 11 ellenfél,
    `players` 13 (mind 1:1 névpár az NHSZ alatt, ugyanabban a szezonban),
    stat 25/26 105 + legacy 78, `hunbasket_player_links` 13 (mind ütközik NHSZ
    kóddal → törlendő), `hunbasket_shotchart_raw` 11, `hunbasket_shot_events`
    672, `game_text_reports` 1; minden más tábla 0. Egyetlen `games` ütközés:
    2025-09-27 (az incidens sora).
  - [x] Mentés: `archive/backups/2026-09-26-szolnok-team-merge.json` (lokális,
    nincs commitolva).
  - [x] Összevonó SQL: `migrations/fix-merge-duplicate-szolnok-team.sql` –
    egy tranzakciós DO blokk; előfeltétel-ellenőrzés (csapatnevek, az ütköző
    meccs állapota, 13/13 egyértelmű játékospár, minden link KEEP megfelelője),
    a végén maradék-DUP-hivatkozás = 0 nélkül nem töröl; bármely hibánál teljes
    visszagörgetés. Mobil jegyzet: `mobile-sync/2026-09-26-szolnok-team-merge.md`.
  - [x] **SQL lefuttatva (2026-09-26), ellenőrizve:** DUP `teams` sor törölve,
    0 maradék hivatkozás; NHSZ alatt 82 saját meccs, 49 játékos (0 név-duplikátum),
    3509 dobás (2837 + 672), dobástérkép home 29 / away 27; a kaposvári sor
    ellenfele visszaállt, az incidens meccssora törölve. `teams`: 16 sor,
    `games`: 1086, 0 NULL `opponent_team_id`. Ellenfél-párosítás:
    **24/25 366/366, 25/26 720/720**. Az incidens ezzel lezárva.
- [x] **Keret import a H3-as szabályon ✓ (2026-09-26)**:
  `scrape-hunbasket-rosters.ts` – `findTeamByNameFuzzy`, új csapat csak
  `HUNBASKET_ALLOW_NEW_TEAMS=1`-gyel, `resolveTeams` előellenőrzés a keretek
  letöltése és bármilyen írás előtt (az összes ismeretlen nevet egyszerre
  jelenti). Ellenőrzés: `tsc` + `eslint` tiszta; olvasó próba a 26/27-es
  tabellán – 14/14 feloldva, egy kitalált új klubnévnél leállna. Éles
  keretfrissítés nem futott (a felhasználó indítja). CLAUDE.md scraping
  konvenció frissítve.

**H8 – Kosarstat link: „nincs párosítható games sor (…, KosarStat.hu vs Do Not Process My Personal Information)” ✓ (2026-09-26)**

Tünet: a `kosarstat:pbp` a 2026-09-25-i három meccsnél (`20260925101140`,
`20260925163119`, `20260925169155`) nem találta a `games` sort. Ok: a
Kosarstat oldalszerkezete változott – a `body` elejére CMP adatvédelmi
dialógus került (`KosarStat.hu - Do Not Process My Personal Information`),
új breadcrumb jelent meg (`Sopron-DEAC - 2026.09.25`), a fejlécben pedig en
dash (`–`) áll kötőjel helyett. A `parseRawPageMetadata()` az első ` - `
sort vette csapatpárnak, az eredményt pedig a `Mérleg: 1-0` sorból olvasta.
Következmény: hibás nyers metaadat, `team_side = unknown` a negyed- és
csapatmetrika sorokon, 6 `games` sor link nélkül.

- [x] **`scrape-kosarstat-playbyplay.ts` – `parseRawPageMetadata()`**: csak a
  táblacellás, **tabulátorral tagolt** fejlécsorokat fogadja el
  (`Hazai\t–\tVendég`, `100\t–\t82`), `-` és `–` elválasztóval is; a szezon |
  szakasz | dátum sor en dash-t is kezel. Ha nincs ilyen sor, `null`
  (önjavító), nem szemét.
- [x] **`KOSARSTAT_FORCE_REIMPORT=true`** mostantól a nyers oldal metaadatát is
  felülírja (eddig a hibás, de kitöltött metaadat „kész” volt, és nem frissült).
- [x] **Regresszió** mind az 1428 tárolt nyers oldalon: 0 eltérő nem-null
  érték; ahol a régi parse más volt, ott a régi érték szemét volt (`ON | OFF
  STAT.`, `Clutch statisztikák`, `2025 | 2026…`), vagy a csonka oldal
  donor-backfillből kapta.
- [x] **Javítás élesben**: force reimport a 3 meccsre – helyes metaadat,
  `team_side` home/away, mind a 6 `games.kosarstat_game_id` beállítva.
  `tsc` (a meglévő Deno-hibán kívül) és `eslint` tiszta.
  Mobil jegyzet: `mobile-sync/2026-09-26-kosarstat-cmp-link-fix.md`.
- Megjegyzés: a `game_quarters` nyers sor metaadata régóta `null`: a
  `/game_quarters/` URL üres oldal, a negyedstatisztika a `/game_qrts/`-ből
  jön. Ez nem hiba, és nem is változott.

**H9 – Hiányzó dobástérkép az ASE–Pécs (2026-09-26) post-game elemzésében ✓ (2026-09-26)**

Tünet: a GitHub scrape lefutott, de a meccs post-game elemzésében nem jelent
meg a dobástérkép. Ok: a Hunbasket `getShootchart` válasza erre a meccsre
(`hun_134749`) **309 elemet** adott, ebből csak **125 egyedi**: minden dobás
bájtra azonosan 2–3-szor szerepelt. A `hunbasket_shot_events` UNIQUE kulcsa
(period, event_order, játékoskód, x, y, is_successful) miatt a teljes batch
insert elbukott. A box-score import ezt csak `console.warn`-nal jelzi, így a
meccs 0 eseménnyel maradt, a `report.shotMap.available` pedig `false` lett.
Érintett meccs: csak ez az egy (a 2025/26-os 359 és a 2026/27-es többi 6 meccs
nyers/esemény száma egyezik).

- [x] **`scrape-utils.ts` – `dedupeShotEvents()`**: a UNIQUE kulccsal azonos
  mezőkön szűri az ismétlődő eseményeket, az első előfordulás marad.
- [x] **`scrape-hunbasket.ts` (`importShotChartForGame`) és
  `process-hunbasket-shotchart-events.ts`** beszúrás előtt deduplikál. A
  nyers tábla (`hunbasket_shotchart_raw.shotchart_data`) továbbra is a teljes
  választ őrzi.
- [x] **Javítás élesben**: `HUNBASKET_SEASON_NAME=2026/2027 npm run
  hunbasket:shotchart:assign` (7 meccs, 902 esemény, 0 hiba, 0 feloldatlan
  játékos). A `hun_134749` meccsnek most 125 eseménye van, az ASE-nak 73 dobása
  (36 sikeres). A webes post-game lekérdezési útvonalon ellenőrizve.
  `tsc` és `eslint` tiszta. Mobil jegyzet:
  `mobile-sync/2026-09-26-shotchart-dedup-fix.md`.
- [ ] **Nyitott (döntés)**: a box-score importban a dobástérkép-hiba csak
  figyelmeztetés, ezért a GitHub Actions futás zöld marad akkor is, ha egy
  meccs dobástérképe nem mentődik. Megfontolandó a futás végi összesítő vagy
  hibakód.


**H10 – Post-game riport-generátor hibái (Pécs–ASE 77–102, 2026-09-26) ✓ (2026-09-27)**

Felhasználói hibalista a Pécs-nézőpontú MD riportra. Ellenőrzés a DB-ben: ASE
nyert 102–77 hazai pályán; mindkét csapatnak van `games` sora, a riport a
kiválasztott csapat (Pécs) szemszögéből készült. Ez szándékos: az elemzésnek
**bármelyik csapatra generálhatónak kell lennie** (felhasználói megerősítés) –
a nézőpont nem hiba.

- [x] **Kis minta referencia** – `MIN_SEASON_BASELINE_GAMES = 3`; alatta a
  `resolveBaseline()` a liga mediánt (P50) használja referenciának a
  szezonátlag (= maga a meccs, minden delta 0) helyett. Új `report.baseline`
  (`kind`, `seasonGames`, `smallSample`, `label`, `noun`); az MD fejléc
  „Kis minta” jelzést és referencia-oszlopcímet kap, a webes kulcsmutató-kártya
  és a hatékonyság-chart címkéje is a referenciát követi. Liga-referenciánál a
  szezon-delta alapú („visszaesett”) erősség/probléma sorok kimaradnak, a
  liga-percentilis sorok maradnak.
- [x] **Célértékek** – a következő fókusz célja a referencia és a liga medián
  közül a jobbik; ha egyik sem jobb a meccsértéknél, nincs önmagára mutató cél
  („22,5% → 22,5%”), csak irány.
- [x] **Rejtett hiba**: a fókusz-szabályok `problems.includes('…')` pontos
  egyezést kerestek zárójeles számot tartalmazó sorokra → az eFG / assist /
  3P / festék / OREB-erősség fókusz **soha nem aktiválódott**. Előtag-alapú
  illesztésre javítva (`hasItemStartingWith`), a liga-alapú problémasorokra is.
- [x] **„Visszaesés” → „Gyenge meccs”** – az underperformer szabály abszolút
  meccsérték (VAL ≤ 3, TS ≤ 47%), játékos-bázis nélkül; a címke minden
  kimenetben (MD, összefoglaló, interpretáció) átnevezve.
- [x] **Címke/rangsor** – a sorrend és címke az impact score (VAL/36 45%, TS%
  25%, usage 20%, St+Bl 10%) szerint megy; Moors 61,0 vs Punter 57,7 → a 0,95-ös
  sáv és a 60-as küszöb miatt eltérő címke. Új: a 60-as küszöb a meccs
  legjobbjára vonatkozik, a tőle ≤10%-ra lévők ugyanazt a vezető címkét kapják
  (`TOP_PERFORMER_BAND = 0.9`). Az MD játékostábla VAL/36, Usage% és Impact
  oszlopot + magyarázó sort kap.
- [x] **ORtg / DRtg / Net** a kulcsmutatók közt és az összefoglalóban, „Fő ok”
  sorral (támadás / védekezés / együtt). A ligabenchmark `ortg`/`drtg` kulccsal
  bővült (0 = nincs adat, kiszűrve).
- [x] **TO% vs pace** – a képlet marad (Oliver-féle TO% = LV / (FGA + 0,44·FTA
  + LV), ugyanez a pregame/csapatelemzésben és a benchmarkokban); a riport
  képlet-magyarázatot kap. A ratingek ugyanazt a saját birtoklásbecslést
  használják, mint a tempó.
- [x] **Ellenfél-bizonyíték** – új „Ellenfél dobás és kontroll” MD szekció
  (`report.metrics.opponent`); a „Perimétervédekezési probléma” és a
  „Lepattanózás gyenge” tényező zárójelben hozza a számot (pl. ellenfél 3P
  10/26, 38,5%).
- [x] Mellékjavítás: az X-faktor alapértelmezett mechanizmusa a szezon
  **összes** pontját vetette össze a meccs pontjaival → meccsátlagra javítva.
- Valós adaton ellenőrizve (Pécs és ASE nézőpont, 14 csapatos 2026/27
  benchmark); `tsc`, `eslint` (csak korábbi figyelmeztetések), `npm run build`
  tiszta. Mobil jegyzet: `mobile-sync/2026-09-27-postgame-baseline-ratings.md`.
- [x] **Névformázás – scraping + adatjavítás (2026-09-27, jóváhagyva)**: a
  Hunbasket box-score / keret táblája 2026 januárja óta ASCII-only
  nagybetűsítéssel adja a vezetéknevet („RéVéSZ”, „BUGLYó”); a dobástérkép
  nyers adataiban a nevek helyesek. `scrape-utils.ts`
  `fixAsciiUppercasedName()` + közös `cleanPlayerName()` (a box-score és a
  keret scraper duplikált példánya helyett). Formátum: a Hunbasket nagybetűs
  vezetékneve marad, csak magyar locale-lal („RÉVÉSZ Ádám”) – a legkisebb
  beavatkozás. `migrations/fix-hunbasket-uppercased-player-names.sql`
  lefuttatva: 124 `players` sor (25/26: 69, 26/27: 55), 0 kulcsütközés, 0 hibás
  maradt; idempotens. Más tábla nem érintett. Mobil jegyzet:
  `mobile-sync/2026-09-27-hunbasket-player-name-casing.md`. A korábbi AI
  szöveges riportok régi névalakja nem javított (historikus szöveg).
- [x] **ASE alapcsapat (2026-09-27, jóváhagyva)**: a `teams` táblában egyetlen
  `is_primary = true` sor sem volt (az ASE sor 2026-01-29-én `false`-szal
  jött létre), ezért a `TeamSelector` alapcsapata az „Alba Fehérvár” lett.
  `migrations/fix-set-ase-primary-team.sql` lefuttatva (`scripts/run-sql.sh`,
  `UPDATE 0` + `UPDATE 1`); az `is_primary`-t a scraperek csak olvassák, a
  logikájuk nem függ tőle. Mobil jegyzet:
  `mobile-sync/2026-09-27-ase-primary-team.md`.
- [x] **MD fejléc szezon mező (2026-09-27)**: a „Szezon” a szezon UUID-ját,
  a „Liga” a szezon nevét mutatta (a `SeasonComparison` `league` értéke a
  szezonnév). A `postgameReportToMd` / `pregameReportToMd` opcionális
  `seasonName` paramétert kap, a fejléc közös `seasonLeagueLine()` segéddel
  „Szezon: 2026/2027” – a Liga csak akkor jelenik meg, ha különbözik. Csak
  webes MD export, mobil jegyzet nem kell.

**H14 – Csapat szezon export (Elemzések → Csapat elemzés → Export MD) hibái ✓ (2026-10-04)** – a kód kész, a takarító SQL lefutott

Felhasználói hibajelzés az ASE 2025/2026 export MD-jére. Gyökérokok:

- **Szezon-szennyezés az adatbázisban** – 2026-02-07-én és 2026-04-20-án a
  box-score import az `x2425` sluggal futott, de a 2025/2026 szezonba írt:
  **276 `games` sor** (csapatonként 19–21, dátum 2024-09-27 – 2025-02-28) és
  **2737 `player_game_stats_2025_2026` sor** került rossz szezonba. Ezért volt
  a fejlécben 58 meccs a valós 39 helyett, és ezért „nem fedte le” a
  dobásbontás a meccsszámot. A `scrape-hunbasket.ts`-ben nincs szezon-dátum
  ellenőrzés (a menetrend importban van).
- **Két különböző meccshalmaz egy riportban** – a pontátlag a `games`
  végeredményeiből jött, a dobásbontás és a játékostábla a szezon view **aktív**
  játékosaiból. Az inaktív játékosok (Hicks 253, Mitchell 31, Géringer 27 pont)
  kimaradtak, a régi szezon sorai viszont benne voltak.
- **Nullák** – a `SeasonComparison` a `games[].players` tömbből átlagolt, ami
  a `useGameData`-ban mindig üres.

Elkészült:

- [x] **Új `lib/team-season-export.ts`** (`buildTeamSeasonExport`) – minden
  csapatszintű szám a meccsenkénti box score sorokból, egyetlen meccshalmazra.
  A szezon dátumablakán (júl. 1. – jún. 30.) kívüli meccsek kimaradnak és
  az „Adatminőség” blokkban jelölve vannak; a végeredménytől eltérő
  pontösszegű (pl. duplán importált) box score nem kerül a mutatókba.
- [x] **`teamStatsToMd` átírva** (`lib/export-to-md.ts`) – fejléc box score
  lefedettséggel és versenyszakasz-bontással; saját **és ellenfél** átlagok,
  eFG / TS / TO rate / OREB%, tempó, ORtg / DRtg / Net; hazai / vendég és
  szakasz szerinti bontás; játékostábla az inaktívakkal, USG%-kal és per-36
  értékekkel, **100 összperces mintaküszöbbel**; elérhetőségi tábla;
  meccsenkénti tábla **minden meccsről** (szakasz, pihenőnap, birtoklás,
  ratingek); ellenfelenkénti összesítés.
- [x] **Ellenfélnév egységesítve** – a `games.opponent_team_id` → `teams.name`
  alapján („Szolnoki Olajbányász” és „NHSZ-Szolnoki Olajbányász” egy sor).
- [x] **Versenyszakasz** – a Kosarstat `competition_phase` címkéjéből
  (`kosarstat_game_pages_raw`, a `games.kosarstat_game_id` linken át);
  sémaváltozás nélkül. Link nélkül a fordulószám → alapszakasz, forduló
  nélkül „Kupa / nem azonosított”. `TeamGame` új opcionális mezői:
  `opponentTeamId`, `round`, `competitionPhase` (`hooks/useGameData.ts` tölti).
- [x] **FT definíció** – külön sor az **FTM rate (FTM/FGA)** (a postgame
  riporttal azonos) és az **FTA rate (FTA/FGA)**, lábjegyzetben a képlettel.
  A TO rate az Oliver-féle, a birtoklás a két csapat becslésének átlaga
  (2026-09-28-i döntés szerint).
- [x] **Mindkét export gomb** (Csapat tab és Elemzések) ugyanazt a függvényt
  hívja; az Elemzések gombja hibát jelez, ha a saját szűrője eltér a fejlécben
  kiválasztott szezontól / csapattól (a meccsadat a fejléc szűrőjéhez tartozik).
- [x] **Teszt** – `tests/team-season-export.test.ts` (6 eset).
  Futtatás: `node --import tsx --test tests/team-season-export.test.ts`.
- [x] **Takarító SQL megírva** – `migrations/fix-remove-2024-25-games-from-2025-26-season.sql`
  (előnézet → törlés egy tranzakcióban → ellenőrzés).
  Mobil jegyzetek: `mobile-sync/2026-10-04-team-game-phase-opponent-fields.md`,
  `mobile-sync/2026-10-04-season-2025-26-stray-games-cleanup.md`.

Nyitott:

- [x] **Takarító SQL lefuttatva (2026-10-04)** – ellenőrzött végállapot: 0
  szezonon kívüli meccs a 2025/2026 szezonban, ASE 39 meccs,
  `player_game_stats_2025_2026` 7194 → 4456 sor, az összesítő-sor „játékos”
  törölve (a Honvéd–ASE 2026-02-22 ellenfél box score így már érvényes). A
  futtatáskor `relation "stray_games" does not exist` hiba jelent meg: a
  törlés ekkorra már végbement, a hiba a `ON COMMIT DROP` temp táblára
  hivatkozó utasítás ismételt / külön futtatásából jött. A script temp tábla
  nélkülire átírva, így részenként és újra is futtatható.
- [x] **Szezon-dátum védelem a box-score és a dobástérkép importban
  (2026-10-04, felhasználói jóváhagyással)** – új közös
  `scrape-utils.ts` `assertDatesMatchSeason()`: a teljes, szűretlen
  menetrend dátumait veti össze a `seasons.start_date`/`end_date`
  értékkel; 10% fölötti kilógásnál írás előtt hibával leáll, alatta csak
  figyelmeztet (elhalasztott meccs, júniusi döntő). Bekötve:
  `scrape-hunbasket.ts` (`getGameLinks`) és `scrape-hunbasket-shotchart.ts`
  (`scrapePlayedGames`) – a 138 rossz szezonú dobástérkép-sor ugyanezen a
  résen jött be. Valós oldalakon ellenőrizve (csak olvasva): `x2425` →
  2025/2026 leáll (182/182 kívül), `x2526` → 2025/2026 és `x2627` →
  2026/2027 átmegy. Teszt: `tests/season-date-guard.test.ts`.
- [ ] A menetrend import (`scrape-hunbasket-fixtures.ts`) saját
  `assertFixturesMatchSeason` példánya átállítható a közös segédre
  (azonos logika, két példányban).
- [ ] **2024/2025-ös shot chart sorok rossz szezon alatt (felhasználói
  döntés 2026-10-04: feladatként marad, később térünk vissza rá)** – 138 `hunbasket_shotchart_raw` sor
  (`season_slug = x2425`, importálva 2026-04-20) a 2025/2026 szezon alatt áll;
  2024/2025 alatt nincs párjuk. Döntés kell: átírás 2024/2025-re (a
  `hunbasket_shot_events` játékos-hozzárendelését újra kell futtatni) vagy törlés.
- [ ] **Összesítő-sor játékosként** – a 2026-02-22-i Honvéd–ASE kupameccsen a
  csapat összesítő sora „játékosként” importálódott (név: csupa `0` és
  tabulátor), ezért a Honvéd box score duplán számolt. A takarító SQL törölte;
  a kézi import parserét (melyik felület írta 2026-02-23-án) meg kell keresni.
- [ ] **2025-12-06 Körmend–Falco** a 2024/2025 szezonban is szerepel (2025-12-07-i
  import, 99–70), a 2025/2026-ban 99–79-cel – a fordított irányú hibás
  hozzárendelés, kézi ellenőrzés kell.
- [ ] **Hiányzó box score-adat** – 2026-02-21 Szolnok–ASE (kupa): a két csapat
  birtoklásbecslése 26%-kal eltér (ASE 47 FGA) – valószínűleg hiányos import;
  2025-12-29 Szedeák: az ellenfél sorok összege 75, a végeredmény 76.
- [ ] **A „3. helyért” szakasz fordulószáma** – a `scrape-hunbasket.ts` a
  „3. helyért” szövegből `round = 3`-at ír; a szakasz tárolása a `games`
  táblában sémadöntés.
- [x] **Negyedprofil, ötösök / on-off, liga-összehasonlítás az exportban
  (2026-10-04, felhasználói jóváhagyással)**:
  - **Negyedprofil** – a `kosarstat_game_quarter_stats` negyedenkénti
    pontjaiból: negyedenként és félidőnként szerzett / kapott pont és
    megnyert – döntetlen – elvesztett mérleg. Csak a végeredménnyel egyező
    összegű meccsek (ASE 2025/2026: 32/39; a két hosszabbításos meccsnél a
    Kosarstat negyedtáblájából hiányzik a hosszabbítás).
  - **Ötösök és on/off** – az Elemzések oldal meglévő szezonszintű Kosarstat
    lineup-összevonásából (`seasonKosarstatLineupTeam.stints`): a 10 legtöbbet
    együtt játszó ötös (perc, pontok, net/40) és játékosonkénti on/off,
    100 perces mintaküszöbbel. Csak az Elemzések export gombja adja át; a
    Csapat tab exportja jelzi, hogy ott nem elérhető.
  - **Liga-összehasonlítás** – minden csapat alapszakasza ugyanazzal a
    számítással (`buildLeagueComparison`): mérleg, pont, tempó, ORtg / DRtg /
    Net, eFG%, TO rate, OREB%, FTM rate, 3P arány, plusz a saját csapat
    mutatónkénti helyezése. Az adat gombnyomásra töltődik
    (`lib/team-season-export-data.ts` `loadTeamSeasonExportExtras`: a szezon
    összes meccse + játékos-sora lapozva; 444 meccs / 4456 sor ~1 mp).
  - **Szakasz-besorolás pontosítva** – a Kosarstat-link sokszor csak a meccs
    egyik nézetén van meg, ezért a címke a tükörmeccs linkjéről is átvehető;
    a link nélküli helyosztók („5. helyért” → `round = 5`) az alapszakasz
    vége után rájátszásnak számítanak, a még nem linkelt következő forduló
    alapszakasz marad (`classifyPhase`).
  - Mindkét export gomb a közös `buildTeamSeasonMd`-t hívja (aszinkron,
    a gomb a betöltés alatt le van tiltva). Tesztek: 12 eset.
  Mobil jegyzet: `mobile-sync/2026-10-04-game-phase-classification-rule.md`.
- [ ] **Az ötös / on-off szakasz valós adaton nincs ellenőrizve** – a
  lineup-adat az Elemzések oldal React állapotából jön (a parser a
  `SeasonComparison.tsx`-ben él, szkriptből nem futtatható); a számítás
  szintetikus adattal tesztelt. Böngészőben egy exporttal ellenőrizendő.
- [ ] **Hiányzó alapszakasz-meccs** – a 2025/2026-os Szolnok–Szedeák
  párharc egyik meccse mindkét csapatnál hiányzik a `games` táblából
  (25 alapszakasz-meccs a 26 helyett).
- [ ] **Kosarstat negyedtábla hosszabbítás nélkül** – a hosszabbításos
  meccseknél (2025-09-27, 2026-03-06) a `kosarstat_game_quarter_stats` csak
  4 negyedet tartalmaz, ezért ezek a negyedprofilból kimaradnak.

**H13 – Post-game export adat-anomáliák (ASE–Körmend 95–84, 2026-10-03) ✓ (2026-10-04)**

Felhasználói hibajelzés a legutóbbi meccs export MD-jére (4 pont). A 3. pont
(aritmetika: 95 pont, 200 perc, negyedek, ORtg/DRtg/Net) rendben volt.

- [x] **1. Téves irányú büntető-címke** – a „Kevesebb büntetőpont az
  ellenfélnél (FTM rate 16,7% vs 27,1%)” az ellenfél hátrányaként volt
  olvasható, pedig a 16,7% a saját értékünk (a `tone` eddig is `negative`
  volt, csak a szöveg volt kétértelmű). Új címke: „Büntető-előny / -hátrány
  az ellenféllel szemben”. `lib/postgame-report.ts` `buildDecisiveFactors`.
  Az export „Döntő tényezők” listája a `decisiveFactorMeta.tone` alapján
  `(+)` / `(−)` jelet és magyarázó lábjegyzetet kap (`lib/export-to-md.ts`).
- [x] **2. „Ellenfél profil” a saját mutatóinkat írta az ellenfélnek** –
  a „védekezési realizáció: kontakt-limitálás / passzútvonal-zavarás” sor a
  saját FTM rate-ünket és Assist%-unkat tulajdonította az ellenfél
  védekezésének. Mostantól: (a) első sor az ellenfél **mért** mutatói (eFG,
  3P, FTM rate, OREB%, TO rate); (b) „Saját támadómutatók a <referencia>
  alatt <ellenfél> ellen: …”; (c) külön „Értelmezés” sor, amely kimondja,
  hogy ez következtetés, nem mért ellenfél-adat. `buildOpponentProfileSection`
  (új `opponent` paraméter, a `buildSummary`-n át).
- [x] **4. Hiányzó alapmutatók** – új opcionális `metrics.boxScore`
  (`PostgameBoxScoreLine`: FG, FT dobott/kísérlet + %, T/V/összes lepattanó,
  saját és ellenfél); az exportban új „Box score alapmutatók” tábla.
- [x] **4. Pontforrások az eseménylistából (1. lépés, felhasználói döntés
  2026-10-04)** – kész mutatót sem a Kosarstat, sem a Hunbasket nem közöl,
  de a már tárolt `game_events` eseménylistából számolhatók. Új
  `lib/kosarstat-pbp-parse.ts` (`parseKosarstatPointSources`, birtoklás-
  követés): második esélyből szerzett pont, labdaeladásból szerzett pont,
  gyors befejezés (labdaszerzés / védőlepattanó után ≤ 6 mp – időalapú
  közelítés, **nem** a jegyzőkönyvi fast break). `SeasonComparison` betölti a
  meccs eseménytábláját; a `mergeKosarstatPostgameContext` csak akkor teszi a
  riportba (`metrics.pointSources`), ha az eseményekből összeadott pontszám
  mindkét oldalon egyezik a végeredménnyel – különben megjegyzés kerül az
  adatminőség-blokkba. Megjelenik a Kosarstat blokkban és az exportban
  („Pontforrások” tábla, definíciós lábjegyzettel). Séma- és scraping-
  változás nincs.
  - Ellenőrzés a tárolt 250 meccsen: 246 / 246 értékelhető meccsnél pontos a
    pontösszeg; ligaátlag csapatonként 11,0 / 15,1 / 13,8 pont.
  - Korlát: eseménylista csak 2025/2026-ra és 2026/2027-re van; 1 meccsnél
    hiányzik az eseménytábla, 2-nél a tárolt végeredmény.
- [ ] **Nyitott (2. lépés, külön döntés):** importkori előszámítás a
  `kosarstat_game_team_metrics`-be + backfill → szezonátlag és liga-medián
  referencia a pontforrásokhoz.
- [ ] **Nyitott adathiba:** a Falco–Szolnok (`20260525127169`) Kosarstat
  nyers oldalán 0–0 a tárolt végeredmény (force reimport kell).
- [x] **AI szöveggenerálás – adathű prompt (2026-10-04)** – a prompt és az
  adatkivonat új modulba került (`lib/game-text-report-prompt.ts`), a route
  csak a hívást és a mentést végzi.
  - **Adatkivonat:** a modell megkapja a `metrics` blokkot (végeredmény,
    kulcsmutatók referenciával és deltával, ratingek, ellenfél mért adatai,
    `boxScore`, `pointSources`), a `baseline`-t, a `dataNotes`-ot és a csapat-
    neveket; a döntő tényezők `tone` iránnyal mennek. Viszonyítási alap nélkül
    a `reference` / `delta` `null`. A H12 óta nem illeszkedő, regex-alapú
    `computedDeltas` megszűnt.
  - **Javított irányhiba:** a régi prompt szerint a `pregame.vulnerabilities`
    „ASE saját gyengeségei”, valójában az **ellenfél** támadható pontjai
    (`buildVulnerabilities(normalizedOpponent)`). A pregame kulcsok a
    kivonatban `opponentProfile` / `opponentThreats` /
    `opponentVulnerabilities` / `opponentKeyPlayers` néven mennek, mellettük
    az `ownTeamProfile`. A beégetett „ASE” helyett `ownTeamName`.
  - **Adathűségi szabályok (16 pont):** egyetlen forrás a JSON; nincs adat →
    nincs állítás; tilos a kitalált meccsesemény, játékperc, egyéni
    szezonátlag (a régi prompt ezt kérte, pedig nincs ilyen adat), hatásbecslés
    és a JSON-mezőnevek emlegetése; a `keyStats` mindig a saját csapaté; az
    X-faktor jelölése a `reflection`-ből jön; a gyors befejezés nem hivatalos
    fast break.
  - **Számellenőrzés:** `findUngroundedNumbers` a generált szöveg tizedes
    számait és a 10 feletti egészeket visszakeresi az adatkivonatban; az
    eltérést a route `unverifiedNumbers`-ként adja vissza, a felület
    figyelmeztető toastot mutat. Heurisztika: a kitalált számot fogja meg, a
    szöveges értelmezést nem.
  - **Időkorlát:** a generálás mérten 65–73 mp, ezért a route `maxDuration`
    60 → 120, az AI hívás időkorlátja 50 → 105 mp (csak ennél a route-nál).
    A hőmérséklet 0,2–0,3 (volt 0,3–0,4). Terjedelmi plafon kb. 5500 karakter,
    `#` címsor és elválasztó nélkül (a felület sima szövegként jeleníti meg).
  - Ellenőrzés: 3 valós generálás a 2026-05-14-i ASE–Kaposvár pillanatképen
    (mentés nélkül); nem igazolt szám egyik futásban sem volt.
- [ ] **Nyitott:** a többi generáló route (`generate-pregame-text`,
  `generate-player-postgame-text`, `generate-player-season-text`,
  `generate-team-analysis-text`) promptja és 60 mp-es kerete nincs átnézve.
- [ ] **Nyitott:** a Vercel csomag felülről korlátozhatja a `maxDuration`-t
  (`HOWTO-vercel-deploy.md`); ha 60 mp a plafon, az éles generálás timeoutol.
- [x] `npx tsc --noEmit` + `npx eslint` tiszta; a kimenet a meccshez igazított
  box score-ral, ideiglenes harness-szel ellenőrizve (nem része a repónak).

Mobil jegyzetek: `mobile-sync/2026-10-04-postgame-ft-label-opponent-profile.md`,
`mobile-sync/2026-10-04-postgame-point-sources.md`.
A már mentett riportszövegek nem változnak – a javítás az újragenerált
riportra / új exportra érvényes.

**H12 – Post-game riportgenerátor hibalista (ASE–Pécs, Szolnok–OSE) ✓ (2026-09-28)** – a 18 pont kész, a Kosarstat reimport lefutott

Felhasználói hibaösszesítő, 18 tétel (P1 szakmai következtetés, P2 adat-
inkonzisztencia, P3 szöveg/UI). Valós adaton reprodukálva: a két meccsre a
`analyzePostGameReport` a DB-ből épített bemenettel futtatva (ideiglenes
harness, nem része a repónak). A javasolt sorrendet követjük, egységenként
külön commit.

**Megállapítás az 1. pontról:** a jelenlegi kód (H10, 2026-09-27) mindkét
meccsnél liga-medián referenciát használ (1 szezonmeccs), és az „FT 23,7% →
23,7%” önmagára mutató cél sem jön elő. A kapott riportok a H10 előtti
kóddal készülhettek. A maradék rést (kis minta + nincs liga benchmark) az A
egység zárja.

- [x] **A – Referencialogika (1, 7, 11) ✓ (2026-09-28)**
  - 11: a szezon- és liga-OREB% a saját lepattanókból számolt
    (`T-lep / (T-lep + saját V-lep)`), a meccsérték az ellenfél V-lepből –
    két definíció egy táblában. Új opcionális `TeamSeasonStat.oppDreb`; a
    `SeasonComparison` a szezon meccsenkénti soraiból számolja
    (`postgameOppDrebByTeam`). 2026/27 liga OREB medián: 28,5% → 26,3%.
  - 7: a célérték a jelenlegi érték és a jobbik referencia közötti sávban,
    meccsenkénti lépéskorláttal (`GOAL_MAX_STEP_PP`): ASE FT rate
    `23.7% → 31.7% (referencia 42.1%)` a korábbi `→ 42.1%` helyett.
  - 1 (maradék): `PostgameBaseline.comparable`; kis minta + liga benchmark
    nélkül „Nincs referencia (kis minta)”, a szöveg és a ratingek nem
    hivatkoznak referenciára, az MD / webes kártya nem ír 0-s deltát.
  - `tsc`, `eslint` (csak a korábbi 5 figyelmeztetés), `npm run build`
    tiszta. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-reference-logic.md`.
- [x] **B – Faktorszelekció és előjel (2, 3) ✓ (2026-09-28)**
  - 2: a döntő tényezők elsődleges forrása a meccs-párharc (saját vs.
    ellenfél: eFG ±5, TO ±4, OREB% ±10, FT rate ±10 pp); a referencia-delta
    (liga medián / szezonátlag, a nevével a címkében) másodlagos, azonos
    témában nem duplikál. Valós adaton: Szolnok első tényezője
    `Lepattanó-fölény (OREB% 37.5% vs 6.9%, +30.6 pp)` (= Kosarstat ORB-
    különbség); az ASE-nél 4 támadó + 1 védekező tényező a „Nincs kiemelt
    faktor” helyett.
  - 3: a védekezési tényezők az ellenfél értékét a liga mediánhoz mérik; a
    „Tripla-volumen kockázat kontroll alatt” ág megszűnt (35–42% között
    pozitívként jelent meg). Szolnok: `Periméter-kockázat (ellenfél 3P 9/24,
    37.5% vs liga medián 32.1%)`, negatív.
  - Explicit `tone` / `source` a `decisiveFactorMeta`-ban; a web ezt használja
    a regexes becslés helyett. Az „<ellenfél> erősség” cím csak negatív
    védekezési faktorra jár (a pozitívra „<csapat> védekezési kontroll”); a
    faktor-részletező védekezési faktorhoz nem mutat saját (0-s) deltát.
  - `tsc`, `eslint` (korábbi 5 figyelmeztetés), `npm run build` tiszta.
    Mobil jegyzet: `mobile-sync/2026-09-28-postgame-decisive-factors.md`.
- **Döntések (felhasználó, 2026-09-28):** TO% = Oliver-féle
  (`LV / (FGA + 0,44·FTA + LV)`), a Kosarstat TO% csak a Kosarstat blokkban;
  FT-mutató = **FTM / FGA mindenhol** a riportban, a benchmark is; USG% =
  standard perc-normalizált képlet, alacsony ≤ 15%, magas ≥ 25%;
  névillesztés = kódbeli alias + naplózás (sémaváltozás nélkül).
- [x] **C1 – Csapatmetrikák (4, 8, 9) ✓ (2026-09-28)**
  - 4: közös birtoklásszám `(saját + ellenfél) / 2` a tempóhoz és mindkét
    ratinghez; a szezon / liga-benchmark is (új `TeamSeasonStat.oppPossessions`,
    `SeasonComparison` `postgameOpponentTotalsByTeam`). ASE–Pécs: birtoklás
    75,5, ASE DRtg = Pécs ORtg = 102,0 (korábban 98,8 vs 105,3).
  - 9: `ftRate` = FTM / FGA a riportban, a ligabenchmarkban és az
    ellenfél-blokkban; címke `FTM rate`, küszöbök FTM-skálára igazítva.
    ASE: 18,4% vs liga medián 31,4%.
  - 8: `TO rate (Oliver)` címke és képlet-lábjegyzet; a Kosarstat TO%
    (LV / birtoklás) kikerült a riport erősség / probléma / fókusz soraiból,
    a Kosarstat nyers blokk feliratai jelöltek, a TO-különbség színe javítva.
  - Nyitott: a pregame / csapatelemzés / `gameStatsToMd` továbbra is FTA / FGA
    „FT rate”-et használ (jelölten) – az átállítás külön döntés.
  - `tsc`, `eslint` (korábbi 5 figyelmeztetés), `npm run build` tiszta.
    Mobil jegyzet: `mobile-sync/2026-09-28-postgame-metric-definitions.md`.
- [x] **C2 – USG% (5) ✓ (2026-09-28)**: a `usageShare` mostantól standard,
  perc-normalizált USG% (`computeUsgRate` / `computeUsageRates`, felső korlát
  60%); tier: alacsony ≤ 15%, magas ≥ 25%; az Impact score usage-komponense
  10–35% között skálázva; a `analyzePlayerImpact` és a webes játékostrend is
  ezt használja. Valós adaton: Daniels 11,8% → 22,5%, Molnár 3,8% → 12,7%,
  Chandler 34,0%. `tsc`, `eslint`, `npm run build` tiszta. Mobil jegyzet:
  `mobile-sync/2026-09-28-postgame-usg-rate.md`.
- [x] **D – Adatvalidáció (6, 10, 13) ✓ (2026-09-28)**
  - 6: új `lib/player-name-match.ts` – vezetéknév-alapú illesztés (a
    nagybetűs token a vezetéknév; kis átírási eltérés engedett:
    KRIVACEVIC ↔ KRIVACSEVICS; becenév hosszú vezetéknévnél: Jay Jay ↔ John
    Watson CHANDLER), kódbeli `PLAYER_NAME_ALIASES` (első bejegyzés: Trey
    WERTZ). **Rejtett hiba javítva:** a régi webes illesztő a 6+ betűs közös
    keresztnév miatt „HALMAI Dániel”-t és „NAGY Dániel”-t összepárosította.
    A `SeasonComparison` minden névpárosítása az új illesztőn megy; a nem
    párosítható / kétértelmű nevek a riport megjegyzéseibe és a konzolba
    kerülnek. 2026/27 teljes ellenőrzés: 4 linkelt meccsen 39/42 név
    párosítva, a maradék 3-ból 2 (Huszár, Dávid, 22 mp) a box score-ból a
    0 perces sor kihagyása miatt hiányzik – ezt a riport külön jelzi –, 1
    becenév (Wertz → alias).
  - 10: `analyzePostGameReport` összeveti a dobástérkép dobásszámát a box
    score FGA-val; eltérésnél megjegyzés (ASE–Pécs: 73 vs 76, 3P% 31,8% vs
    38,5%), 10% feletti hiánynál a dobástérkép-alapú erősség/probléma sorok
    kimaradnak. Az MD új „Adatminőség és megjegyzések” szekciót kap.
  - 13 (felhasználói döntés): a post-game játékospozíció a meccsbeli Kosarstat
    lineup-slot (legtöbb idő), fallback a keretpozíció – ugyanaz a forrás, mint
    a lineup nézet szűrőié (Révész PF, Géringer PF, Daniels SG).
  - `tsc`, `eslint` (korábbi 5 figyelmeztetés), `npm run build` tiszta.
    Böngészős ellenőrzés nem történt. Mobil jegyzet:
    `mobile-sync/2026-09-28-postgame-data-validation.md`.
- [x] **Új tétel (a D ellenőrzése közben) ✓ (2026-09-28, jóváhagyva):** 3 db 2026-09-26-i
  Kosarstat meccs (`20260926114138`, `20260926127201`, `20260926136166`)
  nyers oldala a CMP-dialógus metaadatával („KosarStat.hu” / „Do Not Process
  My Personal Information”) jött be, ezért nincs `games` linkjük. Ok: a
  09-26 18:42 UTC-s GitHub Actions import még a H8 előtti kóddal futott (a
  push csak 09-27-én történt, mint a H11-nél). Teendő (jóváhagyással): a 3
  meccs force reimportja (`kosarstat:pbp` force), majd
  `kosarstat:backfill-links`.
  - Lefuttatva: `KOSARSTAT_FORCE_REIMPORT=true KOSARSTAT_ONLY_GAME_IDS=…
    npm run kosarstat:pbp` – 3 meccs, 27 oldal, 0 hiba; a metaadat helyes
    csapatneveket kapott.
  - Kiderült: szponzornév-driftnél a névalapú linkelés csak az egyik csapat
    `games` sorát találja meg (Kecskemét ↔ „Budapesti Honvéd
    Sportegyesület” / „Endo Plus Service-Honvéd”, Fót ↔ „Falco KC
    Szombathely”). Javítás: `scrape-utils.ts` `withMirrorGames()` – az importer
    és a backfill a tükörsort (felcserélt `our_team_id` / `opponent_team_id`)
    is linkeli. Eredmény: 2026/27-ben 14/14 `games` sor linkelt (korábban 8),
    minden Kosarstat meccshez pontosan 2 sor.
  - ASE–Pécs (`20260926102180`) ✓ (2026-09-28, jóváhagyva): force reimport,
    a nyers metaadat helyes csapatneveket kapott; a 2026/27-ben nem maradt
    CMP-szöveges oldal, a backfill 14/14 linkelt, figyelmeztetés nélkül.
    Mobil jegyzet: `mobile-sync/2026-09-28-kosarstat-ase-pecs-metadata.md`.
  - Mobil összesítő a mai 8 jegyzethez:
    `mobile-sync/2026-09-28-mobil-teendok-osszesito.md`.
  - Mobil jegyzet: `mobile-sync/2026-09-28-kosarstat-reimport-mirror-links.md`.
- [x] **E – UI és szöveg (12, 14–18) ✓ (2026-09-28)**
  - 12: lineup-rangsorok (post-game ötös/páros és a „Leghatékonyabb /
    legjobb védekező együttállások” lista) csak legalább 5 perces mintából
    (`LINEUP_MIN_SAMPLE_SECONDS`), a korábbi „ha nincs stabil minta, jöhet
    bármi” visszaesés nélkül; a lista a perceket is mutatja.
  - 14: „X győzött Y ellen” / „X vereséget szenvedett Y ellen”.
  - 15: a védekezési mondat számokkal és referenciával (ellenfél eFG vs liga
    medián); liga benchmark nélkül nincs viszonyítás (korábban a saját támadó
    eFG volt a tartalék). Új `report.context.defense`.
  - 16: az általános „Végrehajtás stabilizálása…” helyett adatvezérelt
    tartalék-fókusz; az ellenfélprofil a referencia nevével, és nagy
    különbségnél egy, egymást ki nem záró állítást ad.
  - 17: a clutch blokk csak értelmezhető mintánál (clutch szakasz nélkül
    megjegyzés: „Nem volt clutch szakasz…”), a játékostrend csak ≥ 3
    meccsnél, az üres ellenfél-hatás chart rejtve.
  - 18: a „Kosarstat only” kapcsoló leírása az aktuális állapotot írja le.
  - `tsc`, `eslint` (korábbi 5 figyelmeztetés), `npm run build` tiszta;
    a szövegek valós adaton ellenőrizve, böngészős ellenőrzés nem történt.
    Mobil jegyzet: `mobile-sync/2026-09-28-postgame-texts-empty-blocks.md`.

---

**H11 – A 2026/2027-es `games` sorokon nincs `opponent_team_id` ✓ (2026-09-27)**

Tünet: a mobil post-game nézet a 2026/27-es meccseken nem találta az
ellenfél box score-t („Ellenfél” név, OREB% 100%). Ellenőrzés a DB-ben: a
szezon mind a **14** `games` sorában `NULL` az `opponent_team_id`, a 25/26-ban
0/720.

Ok: a C/2 (`fa0a719`, az importok írják az `opponent_team_id`-t) csak
helyben volt commitolva. Az `origin/master` 2026-09-23-án állt, a helyi
`master` 30 committal járt előtte. A GitHub Actions ütemezett scrape-je
(`scrape.yml`) az `origin` régi kódját futtatja. A 14 sor 2026-09-26-án jött
létre, és 2026-09-27 00:26 UTC-kor frissült; a régi upsert payloadban nincs
`opponent_team_id`, ezért a sorok `NULL`-lal jöttek létre.

- [x] **Push (2026-09-27, jóváhagyva)**: `git push origin master`
  (`03e7ddd..64c732d`). A következő Actions futás már a C/2-es importkódot
  használja.
- [x] **Próbafuttatás (csak olvasás)**: mind a 14 sor pontos névegyezéssel
  egyetlen `teams` sorra oldódik fel, és a párja (az ellenfél sora ugyanazon a
  napon) kölcsönösen minket nevez meg. Alias nem kell.
- [x] **Kézi lépés – backfill lefuttatva (2026-09-27)**: a meglévő, idempotens
  `migrations/add-games-opponent-team-id.sql` újrafuttatva az SQL Editorban.
  Ellenőrizve: `games` 1100 sor, 0 `NULL`; a 26/27-es 14 sor ID-je egyezik a
  névvel, önmagára mutató nincs.
- [x] **Mellékkár – elveszett dobásesemények (2026-09-27)**: ugyanez az
  Actions futás a H9 előtti kóddal (`dedupeShotEvents` nélkül) dolgozta fel
  újra a `hun_134749` (ASE–Pécs) dobástérképét. A duplikált válasz miatt az
  insert elbukott, és a meccs 125 eseménye elveszett (a szezonban 902 → 777).
  Helyreállítás jóváhagyással: `HUNBASKET_SEASON_NAME=2026/2027 npm run
  hunbasket:shotchart:assign` – 7 meccs, 902 esemény, 0 hiba, 0 feloldatlan.
  Az ASE-nak ismét 73 dobása van.
- Ellenőrzés a mobil post-game láncon (Pécs–ASE): ellenfél box score 11 sor,
  OREB% 100 helyett 40,6, a dobástérkép 73 dobás.
- Tanulság: az importkód javítása csak push után hat az ütemezett importra.
  Import-író változásnál a push is része a lezárásnak.
- Mobil jegyzet: `mobile-sync/2026-09-27-games-opponent-team-id-2026-2027-backfill.md`.

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
- [x] **Hátralévő kézi lépés ✓ (ellenőrizve 2026-09-21)**: a `player_game_stats_2026_2027` tábla létezik az éles adatbázisban (0 sor), a `lib/season-tables.ts` mapping tehát valós táblára mutat. A 2026/2027-es `league_fixtures` is fel van töltve (182 sor, első forduló 2026-09-25).
- [ ] **Szezonkezdéskor – MOST ESEDÉKES (első forduló: 2026-09-25)**: `is_current` átbillentés (2026-09-21-én még a 2025/2026 az aktuális) + GitHub Actions repo variables (`HUNBASKET_SEASON_SLUG=x2627`, `HUNBASKET_SEASON_NAME=2026/2027`, `KOSARSTAT_SEASON_CODE=2627`, `KOSARSTAT_SEASON_NAME=2026/2027`) átállítása + a 2026/2027-es keretek importja (`npm run hunbasket:rosters`, jelenleg 0 `players` sor erre a szezonra) – lásd `HOWTO-uj-szezon.md` checklist.

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
- [ ] **(Sprintként felvéve 2026-09-21 – lásd „Tervezett sprint – SeasonComparison szétbontása")** SeasonComparison 18k soros monolit szétbontása – típusok → lib parsing → hook → tab-komponensek, a `lib/kosarstat-clutch-parse.ts` kiemelés mintájára
- [ ] **(Sprintként felvéve 2026-09-21 – lásd „Tervezett sprint – Adatlekérés hookokba")** Közvetlen Supabase query-k hookba szervezése

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

## Tervezett sprint – SeasonComparison szétbontása

**Miért**: a `components/SeasonComparison.tsx` **18 072 sor**, 40 top-level
típusdefinícióval, 280 hook-hívással és 38 közvetlen Supabase lekérdezéssel. A
`npm run build` Babel-figyelmeztetést ad rá (`exceeds the max of 500KB`), az
ESLint 4 warningja is innen jön, és a fájl mérete miatt bármilyen módosítás
kockázatos. Ez az egyetlen fájl a komponensek összes közvetlen DB-hívásának
közel harmadát adja.

**Nem cél**: viselkedésváltozás. A tabok, a megjelenített adatok és az
interakciós flow változatlan – ez tisztán szerkezeti bontás.

**Javasolt lépéssor** (a már bevált `lib/kosarstat-clutch-parse.ts` kiemelés
mintájára, egy lépés = egy commit, mindegyik után `tsc` + `eslint` + vizuális
ellenőrzés):

1. **Típusok kiemelése** → `lib/season-comparison-types.ts`. A 40 `type`
   deklarációból a Kosarstat-blokk (`KosarstatLineupTableRow` …
   `KosarstatParsedClutchGame`, a fájl 160–324. sora) és a shot-chart blokk
   (`ShotRawRow` … `ShotProfileSummary`, 1403–1452.) önállóan mozdítható.
   Tiszta, nulla kockázatú első lépés.
2. **Parser/számoló függvények kiemelése** → `lib/season-comparison-*.ts`
   modulokba (lineup, shot-profile, pregame baseline). Ezek tiszta függvények,
   unit-tesztelhetők – a `scrape-utils` szűrőihez írt 19 teszt mintájára
   érdemes hozzájuk is ellenőrzőket írni.
3. **Adatlekérés hookba** → `hooks/useSeasonComparisonData.ts`. A 38
   `supabase.from()` hívás ide költözik; ezzel ez a fájl a lenti
   „Adatlekérés hookokba" sprint legnagyobb tételét is megoldja.
4. **Tab-komponensek szétbontása** → `components/season-comparison/` mappa,
   tabonként egy fájl. A shell csak a tab-váltást és a közös state-et tartja.
5. **Záró ellenőrzés**: a Babel 500KB warning eltűnése, a 4 ESLint warning
   megszűnése (`Database` unused, 3 db `exhaustive-deps`), build + lint tiszta.

**Kockázat**: közepes. A fájl mérete miatt a lépéseket nem szabad összevonni;
minden lépés után külön commit kell, hogy egy regresszió visszakereshető legyen.

---

## Tervezett sprint – Adatlekérés hookokba

**Miért**: **16 komponens 125 közvetlen `supabase.from()` hívást** futtat,
megkerülve a `hooks/` réteget. Jelenleg 3 hook létezik (`useGameData`,
`useFilterData`, `usePlayerMovements`), de a komponensek nagy része nem
használja őket. Következmények: a szezon/csapat szűrés logikája szét van szórva,
a hibakezelés komponensenként eltérő (több helyen csak `console.error`), és
ugyanaz a lekérdezés többször is lefut egy oldalbetöltés alatt.

**A legnagyobb tételek**: `SeasonComparison` (38 – a fenti sprintben oldódik
meg), `PlayersManagement` (22), `JsonImport` (19), `GameDetails` (9),
`PlayersImport` (7), `GameManagement` (6).

**Javasolt lépéssor**:

1. **`useSeasons()` / `useTeams()` bevezetése** – a `seasons` és `teams`
   törzsadatot jelenleg **7 komponens** kéri le külön-külön
   (`PlayersManagement`, `JsonImport`, `GameManagement`, `Updates`,
   `TeamSelector`, `SeasonSelector`, `GameQuickImport`). Ez a legolcsóbb és
   leglátványosabb nyereség: kevés hívási hely, triviális adat, azonnali
   duplikált-lekérdezés megtakarítás.
2. **Admin nézetek hookja** – `usePlayersAdmin()` a `PlayersManagement` +
   `PlayersImport` közös lekérdezéseire (29 hívás együtt).
3. **`GameDetails` adatrétege** → `useGameDetails(gameId)`.
4. **Import nézetek** (`JsonImport`, `GameManagement`, `GameQuickImport`) –
   ezek írnak is, nem csak olvasnak, ezért **külön döntés kell**, hogy a
   mutációk is hookba kerüljenek-e, vagy maradjanak a komponensben.
5. **Egységes hibakezelés** – a hookok adjanak `{ data, loading, error }`
   hármast, a komponensek pedig a meglévő `.skeleton-shimmer` osztállyal
   jelezzék a töltést (ez a „Error boundary és loading state-ek" backlog
   tételt is lezárja).

**Kockázat**: alacsony–közepes. Az 1. lépés önmagában is értékes és
visszafordítható; a 4. lépés előtt architektúrális döntés szükséges.

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

### Auto import (GitHub Actions)

- [ ] **Hétvégi `scrape.yml` run minden hétvégén `exit code 1`** – diagnózis: a Node 20 deprecation warning nem a hiba oka; a tényleges bukás egy konkrét lépésben van (secret hiány → `Hiányzó Supabase env változók`, vagy szezonváltás után `Season not found`). Setup és hibakereső leírás: `HOWTO-auto-import.md`.
  - [x] **`scrape.yml` frissítve ✓ (2026-09-02)** – `actions/checkout@v5` + `actions/setup-node@v5` + `node 22` (deprecation warning megszűnik); új **`Env ellenőrzés`** lépés a setup-node után: érték nélkül, csak hosszt kiírva `exit 1`-gyel jelzi, ha a `NEXT_PUBLIC_SUPABASE_URL` vagy `SUPABASE_SERVICE_ROLE_KEY` repo secret hiányzik – a bukás oka azonnal látszik a logban a scrape lépések előtt.
  - [x] **Ok megtalálva ✓ (2026-09-02)** – a Supabase secretek a `production` GitHub environment alatt voltak, a job nem deklarálta az `environment:`-et → `${{ secrets.* }}` üres. Javítva: `environment: production` a `scrape.yml`-ben (commit `a72743f`, pusholva). A secret-hiba megszűnt.
  - [x] **Kosarstat szezon-változók átadása ✓ (2026-09-02)** – `KOSARSTAT_SEASON_CODE` / `KOSARSTAT_SEASON_NAME` felvéve a `scrape.yml` env blokkba (commit `cd1cfe4`).
  - [ ] **Szezonváltás 2026/2027 – manuális lépések** (a scraper jelenleg a default 2025/2026-ot húzza):
    1. `migrations/add-player-game-stats-2026-2027.sql` lefuttatása a Supabase SQL Editorban (a `seasons` sor: `2026/2027`, `2026-09-01`–`2027-06-30`, `is_current=false`). Enélkül a fixtures import `Season not found: 2026/2027`.
    2. GitHub repo **Variables** (Actions → Variables fül): `HUNBASKET_SEASON_SLUG=x2627`, `HUNBASKET_SEASON_NAME=2026/2027`, `KOSARSTAT_SEASON_CODE=2627`, `KOSARSTAT_SEASON_NAME=2026/2027`. (A `x2627` slug ellenőrizve – a 2026/2027 menetrend fent van a hunbasket.hu-n.)
    3. Amikor az első forduló lejátszódott: `is_current` flip (`HOWTO-uj-szezon.md` szezonkezdési checklist).
  - [ ] Külön döntés: `continue-on-error` a kosarstat lépésen, hiba-értesítés (Issue/e-mail).
- [ ] **Csendes dobástérkép-hiba a box-score importban** (H9 nyomán, 2026-09-26) – a `scrape-hunbasket.ts` a meccsenkénti dobástérkép-mentés hibáját csak `console.warn`-nal jelzi, így a `scrape.yml` futás zöld marad akkor is, ha egy meccsnek nem lesz dobástérképe. Döntendő: futás végi összesítő (hány meccs dobástérképe bukott el) vagy nem nulla kilépési kód, esetleg a kettő együtt. Kapcsolódik a fenti hiba-értesítés tételhez.

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
