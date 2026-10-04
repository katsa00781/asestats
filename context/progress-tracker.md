# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Aktív fejlesztés – meglévő funkcionalitás optimalizálása és bővítése

## Current Goal

- **Bajnokság-szintű játékosmozgás nyomonkövetés** – a fennmaradó scraper-validáció, classification view, import API/UI és dashboard befejezése.

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

- **Játékosmozgás import API/UI (2026-09-21):** új admin-only route és
  `LeaguePlayerMovementsImport` az Import tabon; 3/4 szezonos időtáv,
  opcionális csapatszűrő, futászár, időkorlát, hiba esetén is látható napló.
  Az alaptáblák létezését olvasással ellenőriztük, a szezonos import feltöltötte.
  A felhasználó jóváhagyta a szezonos `boxstats` forrást: az archívum
  első–utolsó éve nem folytonos stint, így a régi kibontás téves adatot adna.
  A teljes buildet egy korábban meglévő Deno/Next TypeScript ütközés
  (`supabase/functions/live-scan/index.ts`, `npm:` import) blokkolja;
  a sidebar korábbi effect-hibája javítva; a lintben 0 error és 7 meglévő warning maradt.

- **Játékosmozgás scraper ✓ (2026-09-21)** – a jóváhagyott szezonos
  `boxstats` forrásból importál, nem az archívum első–utolsó éve közötti
  tartományból. Legújabb menetrend alapján 14 csapat, pontos klub-aliasok,
  teljes táblakiolvasás, írás előtti forrásvalidáció, dry-run, helyes hibakód.
  Éles import: 473 játékos, 847 tagság, 2023/24–2026/27. Négy parser-teszt
  és célzott lint sikeres. A Database típus tartalmazza az alaptáblákat.
  Classification view elkészült, PostgreSQL READ ONLY tesztekkel ellenőrizve
  (szintetikus szélső esetek + valódi Joseph/Chandler ASE-példa).
  A dashboard elkészült: Igazolások nav item, öt KPI, két iránytábla,
  liganézet, szűrés/lapozás, hibakezelés és újrapróbálás. Böngészőben
  ellenőrizve: olvasói elérés, ASE 4 érkező/9 távozó, 14 csapatos liganézet,
  késői válasz eldobása, üres és hiányzó-view állapot, mobil overflow,
  sidebar perzisztencia. Valódi SELECT-eredményt helyettesítő HTTP-válaszok,
  0 böngészős kivétel. Hátra: kézi view-migráció és éles view/RLS ellenőrzés.
  Az alaptáblák RLS-e külön READ ONLY szerepkörteszten megfelelt:
  `authenticated` alatt a besorolás SELECT-je 726 mozgást ad, `anon` alatt
  0 tagság látható. A nézet még nem létezik az adatbázisban.
  A buildhez a Deno-mappa tsconfig-kizárásának jóváhagyása függőben.
  A felhasználó kérésére `npm install` és újabb production build lefutott:
  a függőségek naprakészek, verzióváltozás nincs; a fordítás sikeres,
  a TypeScript továbbra is a `live-scan/index.ts:36` Deno-importjánál hibázik.
- **Élő meccs – csapatszintű meccsstatisztika (2026-09-26)** – az élő
  gyűjtő eddig csak játékos sorokat és negyedeket írt. Új `live_team_stats`
  tábla (`migrations/add-live-team-stats-table.sql`, felhasználói döntés: külön
  tábla, a netcasting „Statisztikák" panel tartalma) és `live-scan`
  `aggregateTeamStats()`/`upsertTeamStats()`, a csapatszintű (2xxx) eseményekkel
  együtt. Valós meccsen ellenőrizve. **Kézi lépések: migráció, majd deploy**
  (ebben a sorrendben). Mobil jegyzet: `mobile-sync/2026-09-26-live-team-stats.md`.
- **Kosarstat metaadat-parser hotfix ✓ (2026-09-26, BACKLOG H8)** – a
  Kosarstat CMP dialógusa és en dash fejléce miatt a 09-25-i meccsek nem
  linkelődtek. A `parseRawPageMetadata()` már csak a tabos fejlécsorokat
  fogadja el; a force reimport a nyers metaadatot is frissíti. A 3 meccs
  élesben javítva, 6/6 `games` link. Mobil jegyzet:
  `mobile-sync/2026-09-26-kosarstat-cmp-link-fix.md`.
- **Élő mérkőzés-gyűjtő (2026-09-04)** – a mobil app (`asestatmobile`) élő
  meccs nézetéhez a backend fele: `migrations/add-live-match-tables.sql`
  (`live_games`/`live_player_lines`/`live_quarter_scores` + RLS) és
  `supabase/functions/live-scan/` Edge Function (MKOSZ netcasting JSON
  forrás, play-by-play eseményekből épített box score – a pontos kód→stat
  leképezés a forrás saját `js/1.n6.js`-éből bizonyítva, nem feltételezés).
  **Edge Function deployolva (2026-09-04, `--use-api`); séma és `pg_cron`
  még NEM éles** – lásd `HOWTO-live-scan.md` és a „Manuális teendők" lenti
  új pontja.
- **Mobil (iOS) Expo alkalmazás – S1 tervdokumentáció ✓ (2026-08-30)**. Négy új context fájl a `context/mobile/` alatt: `mobile-overview.md` (scope + iOS információs architektúra), `mobile-architecture.md` (repo alak + megosztott mag + adatréteg), `mobile-ui-context.md` (design token híd), `mobile-design-prompts.md` (15 vizuális design prompt). **Nincs kódváltozás** – a webes app érintetlen. Következő: S2 vizuális validáció (felhasználói lépés a design eszközben), majd S3 Expo váz.
- **`context/ui-context.md` teljes újraírása ✓ (2026-08-30)** – a fájl elavult volt (Geist fontok, OKLCH shadcn változók, `--radius: 0.625rem`, megszűnt `container mx-auto` header minta). Az új verzió soronként a `globals.css`-ből ellenőrizve dokumentálja a teljes design rendszert, plusz egy „Ami NEM létezik" szakaszt a gyakori félreértésekről.
- **`CLAUDE.md` javítása ✓ (2026-09-01)** – hat eltérés a valós kódhoz igazítva: 2 szín-token (`--text-secondary`, `--text-muted`), a nemlétező `tailwind.config.ts` és a `3xl`/`4xl` breakpointok, a `.card` osztályt és tiltott `as any`-t használó animációs példa, a téves `requireAuth()` állítás (valójában mind a 14 route `requireAdmin`-t futtat, a `requireAuth` holt kód), és 2 hiányzó API route a fastruktúrában.
- (A javítási sprint kódmunkája kész; a 3 migráció kézi futtatására és a GitHub Actions secretek beállítására vár – lásd „Manuális teendők")

## Manuális teendők (a sprint lezárásához)

- **Játékosmozgás:** `migrations/add-league-player-movements-view.sql`
  futtatása a Supabase SQL Editorban. Az alaptáblák és a teljes adatimport
  már készen vannak. Részletes sorrend: `HOWTO-player-movements.md`.

1. **Supabase SQL Editorban futtatandó (ebben a sorrendben!):**
   - `migrations/add-player-game-stats-2026-2027.sql` (2026/27 szezon tábla – a többi migráció hivatkozik rá; 2026-07-18-án javítva: érvénytelen `ADD CONSTRAINT IF NOT EXISTS` szintaxis → DO blokk, policy-k idempotensek)
   - `migrations/add-games-unique-constraint.sql` (games dedup + unique index)
   - `migrations/add-players-unique-index.sql` (players dedup + unique index)
   - `migrations/fix-season-view-games-played.sql` (view: DNP + átigazolás fix – felülírja az előző lépésben létrejött view-definíciót, ez szándékos)
   - A fájlok végén ellenőrző SELECT-ek vannak.
2. **FONTOS**: a games-írók (scraper, GameQuickImport) már `onConflict: 'season_id,our_team_id,date'` upsertet használnak – az első migráció futtatásáig az importok hibát dobnak (szándékos: kikényszeríti a migrációt).
3. **GitHub Actions**: repo Settings → Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; utána a `scrape.yml` workflow_dispatch-csel tesztelhető.
4. **Egyszeri backfill**: `npm run kosarstat:backfill-links` – a meglévő kosarstat meccsek games-linkjeinek pótlása.
5. **Élő mérkőzés-gyűjtő élesítése** (lásd `HOWTO-live-scan.md` részletesen):
   `migrations/add-live-match-tables.sql` futtatása SQL Editorban → `pg_cron`
   + `pg_net` extension ellenőrzése → ~~`supabase functions deploy live-scan`~~
   (kész: 2026-09-04, `--use-api`) → `cron.schedule(...)` a HOWTO 3. pontjából.
   Éles validáció csak a 2026/27 szezon indulása (2026-09-25) után lehetséges.

## Completed (legutóbbi)

- **Hotfix H13 – post-game export adat-anomáliák** (2026-10-04, ASE–Körmend): a kétértelmű „Kevesebb büntetőpont az ellenfélnél” címke helyett „Büntető-előny / -hátrány az ellenféllel szemben”; az export döntő tényezői `(+)` / `(−)` előjelet kapnak; az „Ellenfél profil” az ellenfél mért mutatóit adja, a saját, referencia alatti támadómutatókat pedig nem tulajdonítja az ellenfélnek (külön „Értelmezés” sor); új `metrics.boxScore` (FG, FT, lepattanó) és „Box score alapmutatók” tábla. A TO-ból / második esélyből / fast breakből szerzett pont nincs az importált adatok között – az export ezt jelzi. Érintett: `lib/postgame-report.ts`, `lib/export-to-md.ts`. Mobil jegyzet: `mobile-sync/2026-10-04-postgame-ft-label-opponent-profile.md`. Részletek: `BACKLOG.md` H13.

- **H12 lezárás – Kosarstat reimport + tükörsor-linkelés** (2026-09-28, jóváhagyva): a 3 CMP-metaadatú 09-26-i meccs force reimportja lefutott (27 oldal, 0 hiba); `scrape-utils.ts` `withMirrorGames()` az importerben és a backfillben – szponzornév-driftnél a meccs másik `games` sora is linket kap. 2026/27: 14/14 sor linkelt. Az ASE–Pécs nyers metaadata is javítva (force reimport). Mobil összesítő: `mobile-sync/2026-09-28-mobil-teendok-osszesito.md`. Mobil jegyzet: `mobile-sync/2026-09-28-kosarstat-reimport-mirror-links.md`.

- **Hotfix H12 / E – post-game szövegek és üres blokkok** (2026-09-28): lineup-rangsor ≥ 5 perces mintából; „győzött / vereséget szenvedett … ellen”; védekezési mondat liga-medián referenciával (`report.context.defense`); adatvezérelt tartalék-fókusz és ellentmondásmentes ellenfélprofil; üres clutch / 1 meccses trend / üres chart rejtve; állapotfüggő „Kosarstat only” leírás. Érintett: `lib/postgame-report.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-texts-empty-blocks.md`. A H12 18 pontja kész.

- **Hotfix H12 / D – post-game adatvalidáció** (2026-09-28): új `lib/player-name-match.ts` vezetéknév-alapú box score ↔ Kosarstat illesztéssel és kódbeli aliasokkal (a régi illesztő két „Dániel”-t összepárosított); nem párosítható nevek a riport megjegyzéseiben; dobástérkép vs. box score FGA ellenőrzés a `@core`-ban; a post-game pozíció a meccsbeli Kosarstat lineup-slot. Érintett: `lib/player-name-match.ts`, `lib/postgame-report.ts`, `lib/export-to-md.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-data-validation.md`. Új nyitott: 3 Kosarstat meccs force reimportja (CMP-metaadat, `BACKLOG.md` H12).

- **Hotfix H12 / C2 – standard USG%** (2026-09-28): a post-game `usageShare` perc-normalizált USG% (csapatrészesedés helyett), küszöbök ≤ 15% / ≥ 25%, újraskálázott Impact usage-komponens; a webes játékostrend is ezt használja. Érintett: `lib/player-postgame.ts`, `lib/postgame-report.ts`, `lib/export-to-md.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-usg-rate.md`.

- **Hotfix H12 / C1 – post-game metrika-definíciók** (2026-09-28): közös birtoklásszám `(saját + ellenfél) / 2` a tempóhoz és mindkét ratinghez (meccs, szezon, liga-benchmark; `TeamSeasonStat.oppPossessions`); FT-mutató FTM / FGA a riportban és a benchmarkban; egyetlen TO-definíció (Oliver), a Kosarstat TO% csak a nyers blokkban. Érintett: `lib/postgame-report.ts`, `lib/export-to-md.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-metric-definitions.md`.

- **Hotfix H12 / B – post-game döntő tényezők** (2026-09-28): a faktorok elsődleges forrása a meccs-párharc (saját vs. ellenfél négy faktor), a referencia-delta másodlagos; a védekezés az ellenfél értékét a liga mediánhoz méri (a hibás „Tripla-volumen kockázat kontroll alatt” ág megszűnt); explicit `tone` / `source` a `decisiveFactorMeta`-ban, a web ezt használja. Érintett: `lib/postgame-report.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-decisive-factors.md`. Részletek: `BACKLOG.md` H12.

- **Hotfix H12 / A – post-game referencialogika** (2026-09-28): a felhasználói 18 pontos hibalista első egysége (1, 7, 11). A szezon- és liga-OREB% mostantól az ellenfél V-lepével számol, mint a meccsérték (`TeamSeasonStat.oppDreb`, `SeasonComparison` `postgameOppDrebByTeam`); a célérték sávos, lépéskorláttal (`GOAL_MAX_STEP_PP`); kis minta + liga benchmark nélkül `baseline.comparable = false`, a riport nem hivatkozik referenciára. Az 1. pont fő része már a H10-ben javult (valós adaton ellenőrizve). Érintett: `lib/postgame-report.ts`, `lib/export-to-md.ts`, `components/SeasonComparison.tsx`. Mobil jegyzet: `mobile-sync/2026-09-28-postgame-reference-logic.md`. A B egység külön bejegyzésben.

- **Hotfix H11 – hiányzó `opponent_team_id` a 2026/27-es `games` sorokon** (2026-09-27): a C/2-es importkód (`fa0a719`) nem volt pusholva, a GitHub Actions scrape a régi kóddal írta a 14 új sort. Push megtörtént (`03e7ddd..64c732d`). A `migrations/add-games-opponent-team-id.sql` újrafuttatva (0 NULL / 1100). Mellékkár: a régi kódú futás az ASE–Pécs meccs 125 dobáseseményét elvesztette (H9 regresszió), `hunbasket:shotchart:assign`-nal helyreállítva (902 esemény). Mobil jegyzet: `mobile-sync/2026-09-27-games-opponent-team-id-2026-2027-backfill.md`. Részletek: `BACKLOG.md` H11.

- **Hotfix H10 – post-game riport-generátor** (2026-09-27): kis szezonmintánál (< 3 meccs) liga medián referencia „kis minta” jelzéssel (`report.baseline`); célértékek a jobbik referenciából, önmagukra mutató cél nélkül; a soha nem illeszkedő fókusz-szabályok (`includes` pontos egyezés) javítva; „Visszaesés” → „Gyenge meccs”; ORtg/DRtg/Net + „Fő ok” sor; ellenfél dobás szekció és számokkal alátámasztott védekezési tényezők; impact-score oszlop, 10%-os társvezető-sáv. Érintett: `lib/postgame-report.ts`, `lib/player-postgame.ts`, `lib/export-to-md.ts`, `components/SeasonComparison.tsx` (csak címkék). Utólag (2026-09-27): a pregame/postgame MD fejléc a szezon nevét mutatja UUID helyett. Az ASE ismét alapcsapat (`is_primary`, `migrations/fix-set-ase-primary-team.sql` lefuttatva). A Hunbasket ASCII-nagybetűsített vezetéknevei javítva: `scrape-utils.ts` `cleanPlayerName` / `fixAsciiUppercasedName`, 124 `players` sor (`migrations/fix-hunbasket-uppercased-player-names.sql` lefuttatva). Mobil jegyzet: `mobile-sync/2026-09-27-postgame-baseline-ratings.md`. Részletek: `BACKLOG.md` H10.

- **Hotfix H9 – hiányzó dobástérkép az ASE–Pécs post-game elemzésében** (2026-09-26): a Hunbasket a `hun_134749` meccsre minden dobást 2–3-szor adott vissza (309 elem / 125 egyedi), a `hunbasket_shot_events` UNIQUE kulcsa miatt a teljes insert elbukott. Új `scrape-utils.ts` `dedupeShotEvents()`, bekötve a `scrape-hunbasket.ts` és a `process-hunbasket-shotchart-events.ts` fájlba; a 2026/27-es események újraépítve (902 esemény, 0 hiba). Nyitott döntés: a dobástérkép-hiba ne csak warning legyen a GitHub futásban. Mobil jegyzet: `mobile-sync/2026-09-26-shotchart-dedup-fix.md`. Részletek: `BACKLOG.md` H9.

- **Hotfix H7 – keret frissítés `teams_short_name_key` ütközés** (2026-09-26): a 2026/2027-es szponzornév-drift miatt a roster scraper új csapatot próbált felvenni (`OSE Lions` → `short_name` ütközés `MVM-OSE Lions`-szal). `scrape-utils.ts` `TEAM_NAME_ALIASES` +3 bejegyzés (OSE Lions, Délút-SZTE-Szedeák, Falco KC Szombathely → meglévő `teams` sorok); a tabella mind a 14 csapata feloldódik, DB-írás nem történt. Nyitott: `teams.name` átírása az új nevekre (döntés), roster scraper átállítása a H3-as névdrift-szabályra. Részletek: `BACKLOG.md` H7.
  - **C/1 (2026-09-26)**: `migrations/add-games-opponent-team-id.sql` – `games.opponent_team_id` (FK) + backfill; az átnevezés a régi meccsek ellenfél-párosítását ne törhesse el. **Kézzel futtatandó** az SQL Editorban; utána C/2 (írók) és C/3 (olvasók). Mobil jegyzet: `mobile-sync/2026-09-26-games-opponent-team-id.md`.
  - **C/1 lefuttatva + C/2 (2026-09-26)**: backfill ellenőrizve (1086/1086); az importok (`scrape-hunbasket.ts`, `GameQuickImport`, `JsonImport`) írják az `opponent_team_id`-t. Következő: C/3 (olvasók).
  - **C/3 (2026-09-26)**: `useGameData`, `TeamComparison`, `JsonImport` az `opponent_team_id`-n párosít (név fallback); ellenfél-meccs párosítás 24/25 314→366, 25/26 634→720. A C/2 ellenőrző importja a 25/26 1. fordulóban duplikált Szolnok meccssort írt a duplikált `Szolnoki Olajbányász` csapatsor alá.
  - **Szolnok összevonás (2026-09-26)**: `migrations/fix-merge-duplicate-szolnok-team.sql` lefuttatva – a duplikált teams sor (2026-04-19, playoff import) az `NHSZ-Szolnoki Olajbányász`-ba olvasztva, az incidens visszaállítva; alias `szolnoki olajbanyasz → nhsz-szolnoki olajbanyasz`. Ellenfél-párosítás 24/25 366/366, 25/26 720/720. Nyitott H7-tétel: `teams.name` átnevezése az új szponzornevekre.
  - **Alias névcsoportok + keret import védelme (2026-09-26)**: a matcher az aliasokat egyenértékű névcsoportként kezeli (átnevezés előtt/után is ugyanaz a sor); a `scrape-hunbasket-rosters.ts` fuzzy matchinggel, írás előtti névfeloldással és auto-létrehozás nélkül fut (`HUNBASKET_ALLOW_NEW_TEAMS=1` kell új csapathoz).

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

- **Post-game metrika-definíciók** (2026-09-28, felhasználói döntés, H12): a post-game riportban a TO rate az Oliver-féle `LV / (FGA + 0,44·FTA + LV)`, az FT-mutató FTM / FGA (a benchmark is), a birtoklás a két csapat becslésének átlaga, a USG% a standard perc-normalizált képlet (alacsony ≤ 15%, magas ≥ 25%). A Kosarstat saját definíciói (TO% = LV / birtoklás) csak a Kosarstat nyers blokkban jelennek meg, jelölten. Box score ↔ Kosarstat névillesztés kódbeli aliasszal, sémaváltozás nélkül.

## Session Notes

- A kontextus fájlok 2026-05-11-én készültek el a meglévő CLAUDE.md és projekt vizsgálata alapján
- A projekt repository: <https://github.com/katsa00781/asestats> (privát)
- Folytatáshoz: olvasd el az összes kontextus fájlt sorban, majd kérdezd meg a felhasználót, mi a következő fejlesztési egység
