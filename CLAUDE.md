# CLAUDE.md – ASEStats Projekt

## Szerepköröm

Senior full-stack fejlesztő vagyok ezen a projekten. Ismerem az architektúrát, az adatbázis sémát, a scraping logikát és az UI konvenciókat. Inkrementálisan dolgozom: egyszerre egy feature unit, kicsi ellenőrizhető változások. Nem kombinálok összefüggéstelen rendszerhatárokat (pl. UI + migráció egyszerre). Architektúrális döntéseket nem hozok meg önállóan – megkérdezem a felhasználót.

A részletes context fájlok itt találhatóak, ezeket implementáció előtt el kell olvasni:
- `context/project-overview.md` – termékdefiníció, scope
- `context/architecture.md` – rendszerhatárok, storage modell, invariánsok
- `context/ui-context.md` – téma, színek, komponens konvenciók (Dark Command Center)
- `context/code-standards.md` – implementációs szabályok
- `context/ai-workflow-rules.md` – workflow és scoping szabályok
- `context/progress-tracker.md` – jelenlegi állapot, következő lépések

---

## Projekt áttekintés

**ASEStats** – Magyar kosárlabda statisztikai és elemzési platform az ASE (Atomerőmű SE) kosárlabdacsapat belső használatára. Az alkalmazás:
- Automatikusan gyűjt mérkőzés-adatokat Hunbasket.hu-ról és Kosarstat.hu-ról (Playwright scraping)
- Tárolja az adatokat Supabase (PostgreSQL) adatbázisban
- Next.js dashboardon jeleníti meg szezon/csapat szűréssel
- AI-alapú pregame scouting és postgame elemzési szöveges riportokat generál (OpenAI / Claude)
- Bejelentkezés-védett, csak belső felhasználóknak

---

## Design rendszer: "Dark Command Center"

Az UI egységes, sportos-telemetria érzetű sötét felület. Részletek: `context/ui-context.md` + `app/globals.css`.

**Vizuális identitás:**
- Sötét kék mély háttér (`#050B14`) + felfelé világosodó surface skála
- Cián accent (`#00D4FF`) primary; narancs (`#FF6B35`) CTA / kiemelés; lila (`#7C3AED`) AI generált tartalom
- Pont-rács háttér (`radial-gradient`), finom telemetria glow-k
- 3 betűcsalád szigorú szereposztással (lásd lentebb)
- Glow-alapú interakció: hover/focus → cián fény, nem szín-váltás

**Single Source of Truth**: `app/globals.css` – a `:root` blokkban nyers tokenek, a `@theme inline` blokkban Tailwind utility-vé konvertálva. **A színeket sem `tailwind.config.ts`-ben, sem komponensben nem definiáljuk újra.**

**Fontos: a redesign jelenlegi scope-ja kizárólag vizuális stílus.** Az alkalmazás funkcionalitása, a 12 tab-os navigáció és a komponens-szintű viselkedés változatlan marad. A komponensek **belsőleg** állnak át az új design tokenekre, `StatCard`-ra és `DataTable`-re, de a tabok, az adatlekérés, a route-ok és az interakciós flow ugyanaz. Layout átstrukturálás (sidebar / topbar / ⌘K / breadcrumb / sync indikátor) későbbi backlog – lásd `BACKLOG.md`.

---

## Tech Stack

| Réteg | Technológia | Verzió |
|-------|-------------|--------|
| Framework | Next.js App Router | ^16.0.10 |
| UI | React | ^19.2.1 |
| Nyelv | TypeScript | ^5, strict mode |
| Stílus | Tailwind CSS (CSS-first, `@theme inline`) | ^4 |
| Komponens könyvtár | shadcn/ui (New York stílus) + Radix UI – globals.css override-okkal | – |
| Adatbázis | Supabase (PostgreSQL) | @supabase/supabase-js ^2.93.1 |
| Auth | Supabase Auth (email/jelszó) | – |
| Chart | Chart.js + react-chartjs-2 | ^4.5.1 / ^5.3.1 |
| Chart | Recharts | ^3.4.1 |
| Ikonok | Lucide React (stroke 1.5–1.8) | ^0.553.0 |
| Scraping | Playwright | ^1.58.0 |
| CLI script runner | tsx | ^4.20.6 |
| Toast | Sonner | ^2.0.7 |
| AI szöveg generálás | OpenAI (gpt-4.1-mini) / Anthropic (Claude) | fetch-alapú |
| Linter | ESLint 9 (next/core-web-vitals) | ^9 |
| Animációk | tw-animate-css + saját `@keyframes` | ^1.4.0 |
| CSS utility | clsx + tailwind-merge (`cn()`) | – |
| CVA | class-variance-authority | ^0.7.1 |
| Fontok | Barlow Condensed · DM Sans · JetBrains Mono (next/font/google) | – |

---

## Mappastruktúra

```
asestats/
├── app/                        # Next.js App Router
│   ├── api/                    # API route-ok (minden route force-dynamic)
│   │   ├── eurobasket-player-import/
│   │   ├── game-text-report/
│   │   ├── generate-game-text-report/
│   │   ├── generate-player-postgame-text/
│   │   ├── generate-player-season-text/
│   │   ├── generate-pregame-text/
│   │   ├── generate-team-analysis-text/
│   │   ├── hunbasket-fixtures-import/
│   │   ├── hunbasket-roster-import/
│   │   ├── hunbasket-round-import/
│   │   ├── kosarstat-pbp-cleanup/
│   │   └── kosarstat-pbp-import/
│   ├── favicon.ico
│   ├── globals.css             # Design tokenek + @theme inline + shadcn override + animációk
│   ├── layout.tsx              # next/font: Barlow Condensed / DM Sans / JetBrains Mono · AuthProvider · Toaster
│   └── page.tsx                # Tab-alapú dashboard (változatlan struktúra, csak stílus)
├── components/                 # React UI komponensek
│   ├── ui/                     # shadcn/ui alapkomponensek – NE MÓDOSÍTSD kézzel
│   │   ├── badge.tsx, button.tsx, card.tsx, input.tsx
│   │   ├── label.tsx, select.tsx, tabs.tsx, textarea.tsx, tooltip.tsx
│   │   ├── stat-card.tsx       # Új: KPI / metrika kártya (Dark Command Center)
│   │   └── data-table.tsx      # Új: generikus sortolható tábla (ColumnDef<T>)
│   └── [Feature komponensek]   # Lásd lentebb
├── context/                    # Projekt spec és kontextus fájlok (nem kód)
│   ├── ai-workflow-rules.md
│   ├── architecture.md
│   ├── code-standards.md
│   ├── progress-tracker.md
│   ├── project-overview.md
│   └── ui-context.md           # Dark Command Center design rendszer leírása
├── lib/                        # Megosztott logika, típusok, segédfüggvények
│   ├── auth-context.tsx
│   ├── dashboard-types.ts      # Publikus dashboard típusok (kiszervezve page.tsx-ből)
│   ├── player-analysis.ts
│   ├── player-postgame.ts
│   ├── positions.ts
│   ├── postgame-report.ts
│   ├── pregame-scouting.ts
│   ├── season-tables.ts
│   ├── situational-analysis.ts
│   ├── style-vocabulary.ts
│   ├── supabase.ts
│   ├── team-analysis.ts
│   ├── terminology.ts
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── hooks/                      # Kiszervezett adatlekérési hookok
│   ├── useGameData.ts
│   └── useFilterData.ts
├── migrations/                 # SQL migrációs fájlok – csak Supabase SQL Editorban futtatni
├── scripts/                    # Node.js adatbázis segédeszközök
├── archive/                    # Egyszeri diagnosztikai szkriptek (fix-*, check-*, delete-*)
├── public/                     # Statikus fájlok
│   └── data/games.json
├── data/games.json             # Historikus meccsadatok (archív fallback)
├── [scrape-*.ts]               # Playwright CLI scraping szkriptek (gyökérszint)
├── .env.local                  # Titkos változók – soha ne kerüljön git-be
├── .env.local.example
├── next.config.ts
├── components.json             # shadcn/ui konfiguráció (New York stílus)
├── tailwind.config.ts          # CSS-first: csak content scan + opcionális breakpointok
└── tsconfig.json
```

### Főbb feature komponensek

A komponensek **funkcionalitása változatlan**, csak a vizuális réteg (osztályok, design tokenek, betűtípus, animáció) áll át a Dark Command Center rendszerre.

| Komponens | Felelősség |
|-----------|-----------|
| `PlayersList.tsx` | Aggregált szezon statisztikák (DataTable-re átállítva) |
| `PlayerDetails.tsx` | Részletes játékos nézet, gameHistory, trendek |
| `PlayerComparison.tsx` | Játékos összehasonlítás (cross-season) |
| `PlayerTrends.tsx` | Trend chartok (Recharts) |
| `TeamStatistics.tsx` | Csapat szintű átlagok (StatCard-okkal) |
| `TeamComparison.tsx` | Csapat összehasonlítás |
| `SeasonComparison.tsx` | Szezon összehasonlítás |
| `GamesList.tsx` | Mérkőzések + közelgő fixtures |
| `GameLog.tsx` | Meccs előzmények részletes bontása (DataTable) |
| `GameDetails.tsx` | Egyedi meccs részletei (StatCard + DataTable kombináció) |
| `SituationalAnalysis.tsx` | Hazai/vendég, nyert/veszített bontás |
| `StandingsView.tsx` | Tabella megjelenítő (DataTable) |
| `StandingsImport.tsx` | Tabella kézi import |
| `KosarstatPbpImport.tsx` | Kosarstat PBP import UI |
| `FixturesImport.tsx`, `RosterImport.tsx`, `RoundImport.tsx`, `GameQuickImport.tsx`, `JsonImport.tsx` | Import felületek |
| `PlayersManagement.tsx`, `PlayersImport.tsx`, `GameManagement.tsx` | Admin kezelés |
| `PostgameShotScatterChart.tsx`, `PostgameZoneHeatmapChart.tsx` | Shot chart vizualizáció (Chart.js) |
| `SeasonSelector.tsx`, `TeamSelector.tsx` | Globális szűrők |
| `LoginForm.tsx` | Bejelentkezési form (Dark Command Center stílus) |
| `Updates.tsx` | Frissítések nézet |

### Új közös komponensek

| Komponens | Felelősség |
|-----------|-----------|
| `components/ui/stat-card.tsx` | KPI kártya: label + value (JetBrains Mono) + opcionális trend + opcionális ikon + accent szín (`cyan` / `orange` / `green` / `purple`). Belépéskor `animate-fade-slide-up` + `animate-count-up`. |
| `components/ui/data-table.tsx` | Generikus, típusos tábla: `ColumnDef<T>` (key, label, numeric, center, sortable, sortAccessor, width, render). Saját sort state, `activeRowId` támogatás, `footer` slot. CSS-rétegben `dt-th`, `dt-num`, `dt-num--muted`, `dt-sort-icon` osztályok. |

---

## Adatbázis táblák (Supabase PostgreSQL)

| Tábla | Tartalom |
|-------|---------|
| `games` | Mérkőzések (dátum, ellenfél, eredmény, szezon, csapat) |
| `players` | Játékos alapadatok (név, szám, pozíció, szezon, csapat, aktív) |
| `player_game_stats_2023_2024` | Meccsenkénti statisztikák – 2023/2024 szezon |
| `player_game_stats_2024_2025` | Meccsenkénti statisztikák – 2024/2025 szezon |
| `player_game_stats_2025_2026` | Meccsenkénti statisztikák – 2025/2026 szezon |
| `player_game_stats` | UNION view visszafelé kompatibilitáshoz (INSTEAD OF triggerekkel) |
| `seasons` | Szezonok (id, név, start/end dátum) |
| `teams` | Csapatok (id, név, rövid név, is_primary) |
| `league_fixtures` | Bajnokság mérkőzésnaptár |
| `standings` | Tabella adatok (RLS engedélyezve) |
| `play_by_play_events` | Play-by-play eseményadatok |
| `shotchart_events` | Shot chart pozíció adatok |
| `game_text_reports` | AI generált pregame/postgame riportok (RLS engedélyezve) |
| `team_text_reports` | AI generált csapat szezon riportok (RLS engedélyezve) |
| `player_season_stats_by_season` | **VIEW**: aggregált szezon statisztikák |

**Új szezon hozzáadásához**: bővíteni kell `lib/season-tables.ts` `SEASON_STATS_TABLES` mappinget ÉS egy SQL migrációt kell írni a `migrations/` mappába. Részletes lépéssor: `HOWTO-uj-szezon.md`.

---

## Fejlesztési filozófia

- **Feature-by-feature**: egyszerre egy jól körülhatárolt fejlesztési egységen dolgozom
- **Server Components alapértelmezett**: `'use client'` csak ha böngésző API vagy hook szükséges
- **Egyszerű és olvasható kód**: ne keverj UI logikát, adatfeldolgozást és API hívásokat egy fájlban
- **Magyar UI, angol kód**: kommentek és dokumentáció magyarul, identifikátorok angolul
- **Inkrementális változások**: nagy spekulatív refaktorálás helyett kis, ellenőrizhető lépések
- **Design tokenek tisztelete**: minden szín, font, spacing CSS változón keresztül – soha hardcoded hex vagy px érték a komponensekben
- **Stílus ≠ funkció**: a redesign sprint során a komponensek viselkedését, route-okat, adatlekérést NEM módosítjuk; csak az osztályokat, tokeneket, layoutot a kártya/tábla szintjén

---

## Döntési szabályok

**Mit ne változtass engedély nélkül:**
- `components/ui/*` – shadcn/ui generált fájlok; csak `npx shadcn@latest add`-del módosítandó (kivéve a projekt-szintű `stat-card.tsx` és `data-table.tsx`, amik szintén ide kerülnek de saját komponensek)
- `app/globals.css` `:root` és `@theme inline` blokk – a design rendszer Single Source of Truth-a, csak design döntés nyomán bővíthető
- `migrations/*.sql` – Supabase SQL Editorban futtatandó, nem a kódbázisból
- `tsconfig.json` – strict mode beállítások nem módosíthatók
- `app/layout.tsx` – csak AuthProvider, font konfiguráció vagy metadata változásakor
- `.env.local` – soha nem módosítandó az implementáció részeként
- **Route struktúra, tab navigáció, adatlekérési flow** – a stílus sprint nem érinti

**Mikor kérdezz rá:**
- Új npm csomag hozzáadása előtt
- Adatbázis séma módosítása előtt
- Új design token bevezetése előtt (új szín, új font-méret, új animáció)
- Architektúrális döntés előtt (pl. state kezelés módosítása, route szerkezet)
- Ha egy követelmény nincs egyértelműen definiálva a context fájlokban
- Ha egy stílus-feladat funkcionális változtatást igényelne (jelezni kell, és külön döntés szükséges)

---

## UI szabályok – Dark Command Center

### Téma és színrendszer

- **Téma**: sötét mód only. A `<html>` elemen `className="dark"`, a `<body>` `bg-base text-primary`.
- **Surface skála** (mélységi rétegekben):
  - `bg-base` (`#050B14`) – oldal háttér
  - `bg-surface-1` (`#0A1628`) – card alap
  - `bg-surface-2` (`#0F1F3D`) – hover, popover, input
  - `bg-surface-3` (`#162440`) – nested elem, aktív tab háttér
- **Accentek**:
  - `text-cyan` / `bg-cyan` (`#00D4FF`) – primary, fókusz, link, aktív állapot
  - `text-orange` / `bg-orange` (`#FF6B35`) – CTA, kiemelt érték
  - `text-ai` / `bg-ai` (`#7C3AED`) – AI generált tartalom jelölése (`.ai-marker` osztály)
- **Szemantikus**:
  - `text-positive` (`#10D98A`) – delta-up, growth, nyert
  - `text-negative` (`#FF4757`) – delta-down, vesztett, élő jelzés
  - `text-warning` (`#FFB627`) – watch, figyelmeztetés
- **Szöveg**:
  - `text-primary` (`#E8F4FF`) – főszöveg
  - `text-secondary` (`#5A7A99`) – kísérőszöveg
  - `text-muted` (`#2D4A6B`) – placeholder, deaktivált
- **Vonalak**: `border-subtle`, `border-active`, `border-strong` – növekvő láthatóság

### Tipográfia – 3 család, szigorú szereposztás

| Család | Tailwind | Mire való |
|--------|----------|-----------|
| **Barlow Condensed** | `font-display` | H1–H4, label, badge, gombok, tab triggerek. ALL CAPS + 0.1–0.14em tracking labeleknél. |
| **DM Sans** | `font-sans` (default) | Body szöveg, leírások, paragrafusok. |
| **JetBrains Mono** | `font-mono` | Minden numerikus érték (`stat`, `[data-stat]` selector). Kötelező `tabular-nums` + `font-variant-numeric: tabular-nums`. |

A 3 fontot a `app/layout.tsx` `next/font/google`-on keresztül tölti be, CSS változókat (`--font-display`, `--font-body`, `--font-mono`) renderel a `<body>` className-be.

### Komponens szabályok

- **Komponens könyvtár**: shadcn/ui New York stílus – `components/ui/` mappából. Az alap shadcn változókat (`--background`, `--foreground`, `--primary` stb.) a `globals.css` átírja a Dark Command Center palettára, így a Card / Button / Badge / Input / Select / Tabs azonnal helyes stílust kap.
- **Elérhető alapkomponensek**: `Button`, `Card`, `Input`, `Label`, `Select`, `Tabs`, `Textarea`, `Tooltip`, `Badge`, `StatCard` (új), `DataTable` (új)
- **Új shadcn komponens**: `npx shadcn@latest add <component-name>` – soha ne kézzel írj `components/ui/`-ba (kivéve a projekt-szintű komponenseket: `stat-card.tsx`, `data-table.tsx`)
- **Tab navigáció**: a meglévő shadcn `Tabs` komponens marad a 12 nézet kapcsolójaként, csak a stílusa frissül (Barlow Condensed, uppercase, cián glow aktív állapotban).
- **Ikonok**: Lucide React, stroke-alapú. Stroke-width: `1.5` finomabb, `1.6–1.8` standard, `2` erős. Méretek:
  - Inline szöveg mellett: `h-3.5 w-3.5` vagy `h-4 w-4`
  - Gombokban: `h-4 w-4`
  - Header / nagy elem: `h-5 w-5` vagy `h-6 w-6`
- **Toast**: Sonner – `import { toast } from 'sonner'` → `toast.success()` / `toast.error()`
- **Badge variánsok**: `badge-cyan`, `badge-orange`, `badge-ai`, `badge-positive`, `badge-negative`, `badge-warning`, `badge-neutral` – mindegyik kis méretű (`0.7rem`), uppercase, `0.12em` tracking, finom border (`color-mix` 30% áttetszéssel).

### Spacing és sarok

- **Radius skála**: `--radius-xs` (2px badge/tag), `--radius-sm` (4px input/small button), `--radius-md` (6px button/tab), `--radius-lg` (10px card), `--radius-xl` (14px modal)
- A `--radius` shadcn változó alapértelmezetten `--radius-md`

### Glow és árnyékok

- **Glow-k**: `shadow-glow-cyan`, `shadow-glow-cyan-hot`, `shadow-glow-orange`, `shadow-glow-orange-hot`, `shadow-glow-ai`, `shadow-glow-positive`, `shadow-glow-negative`
- **Panel árnyék**: `shadow-panel` – `0 1px 0 0 rgba(255,255,255,.03) inset` + `0 24px 60px -28px rgba(0,0,0,.8)`. Cardokon.
- Hover állapotban a primary gomb `box-shadow: 0 0 24px var(--glow-cyan-hot)` + `filter: brightness(1.08)`.

### Háttér

- Globális pont-rács: `body` elemen 3 réteges `background-image` (radial dot pattern + 2 nagy radial glow folt). A `body` `background-attachment: fixed`-en marad.
- Egyedi felületre: `.grid-overlay` (32px rács) vagy `.dot-overlay` (16px pont) utility.

### Animációk

| Utility | Mire való | Időzítés |
|---------|-----------|----------|
| `.animate-count-up` | Stat érték első megjelenése (blur fade + slide) | 1.2s `--ease-snap` |
| `.animate-fade-slide-up` | Card / lista elem belépése | 400ms `--ease-snap` |
| `.animate-pulse-glow` | LIVE jelzés, AI loading | 1.8s ∞ |
| `.animate-blink` | Cursor / pulzáló indikátor | 1.1s steps(2,end) ∞ |
| `.animate-scan` | Telemetria sávozás overlay | 3s linear ∞ |
| `.skeleton-shimmer` | Betöltés alatti lista / kártya | 1.6s linear ∞ |
| `.stagger > *` | Gyermek elemek egymás után belépése (60ms × `--i`) | – |

**Belépő animáció minta**:
```tsx
<div className="card animate-fade-slide-up" style={{ ['--i' as any]: 2 }}>...</div>
```
Listáknál a szülő `stagger`-t kap, gyermekek `--i={index}`-et.

**Egyedi utility osztályok**: `.ai-marker` (bal oldali halvány lila gradient sáv, AI tartalom jelölésére), `.live-dot` (8px piros pulzáló pont), `.bar-track` + `.bar-fill` (mini progress / sparkline háttér), `.hairline` (finom horizontális divider).

---

## Styling szabályok

- **Tailwind CSS 4** utility osztályok mindig – class név a komponensben, soha `style={{ color: ... }}` literal kivéve dinamikus értékre (pl. `--i`, `--accent-color`).
- **CSS-first konfiguráció**: a `app/globals.css` `@theme inline` blokkja a Single Source of Truth. A `tailwind.config.ts` csak `content` scant és opcionális breakpointokat (`3xl`, `4xl`) deklarál – színt vagy fontot oda nem írunk.
- Osztály kombinálás: `cn()` helper (`lib/utils.ts`) – `clsx` + `tailwind-merge`
- **Hardcoded hex szín tiltott** – mindig CSS változó token (`var(--accent-cyan)`) vagy Tailwind utility (`text-cyan`). Egyetlen kivétel: inline SVG `stroke` attribútum, ahol nem CSS, hanem SVG attribute kontextusban vagyunk – de még ott is használj `currentColor`-t ha lehet.
- Komponens variánsokhoz: Class Variance Authority (`cva`) – `button.tsx` mintájára. A változatokat data-attribútumon (`data-variant`, `data-active`, `data-state`) keresztül is el lehet érni, mert a `globals.css` ezekre is illeszt szelektort.
- Egyedi CSS: csak `globals.css`-ben CSS változók definiálásakor vagy a 4 nagy szekció valamelyikében (`@layer base`, shadcn override, animációk, utility osztályok).

---

## State management

Nincs külső state manager. React 19 beépített hookok:
- `useState`, `useCallback`, `useEffect`, `useMemo` – lokális és oldal-szintű state
- Globális auth állapot: `useAuth()` hook (`lib/auth-context.tsx`)
- Adatlekérés kiszervezve: `hooks/useGameData.ts`, `hooks/useFilterData.ts`
- Publikus dashboard típusok: `lib/dashboard-types.ts`
- `app/page.tsx` mostantól ~250 sor (korábbi monolitikus ~1090-ről) – csak shell rendering és tab routing

---

## TypeScript szabályok

- **strict mode** kötelező (`tsconfig.json`: `"strict": true`) – nem módosítható
- `any` típus tilos – explicit interfészek vagy narrowing
- Külső adatokat (Supabase válaszok, scraping) validálni kell a rendszerhatárokon
- Típus importok: `import type { ... }` – az importlista elejére
- Path alias: `@/lib/...`, `@/components/...`, `@/hooks/...` – relatív `../../` import nem megengedett
- Supabase sorok típusai: `lib/supabase.ts` `Database` típusból leszármaztatva
- Generikus komponensek: `DataTable<T>` mintájára – a `ColumnDef<T>` típus is a komponens fájljában exportálódik

---

## API és adatbázis szabályok

- **Supabase kliens**: egyetlen példány, `lib/supabase.ts` – ne hozz létre másikat
- **Admin API route-ok** (riport generálás, adatmódosítás): `SUPABASE_SERVICE_ROLE_KEY` + `createClient(url, serviceRoleKey)`
- **Minden lekérdezés szűrt**: `season_id` és `team_id` szerint – szűretlen full-table scan tiltott
- **Szezonspecifikus táblák**: `lib/season-tables.ts` `getSeasonStatsTable()` – a `player_game_stats` UNION view az 1000 soros PostgREST limitbe ütközhet
- API route kötelező direktívák import/scraping esetén:
  ```ts
  export const dynamic = 'force-dynamic'
  export const runtime = 'nodejs'
  export const maxDuration = 300  // hosszú futású scraping route-okhoz
  ```
- Supabase lekérdezés minta:
  ```ts
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('season_id', selectedSeasonId)
    .eq('our_team_id', selectedTeamId)
    .order('date', { ascending: false });
  if (error) throw error;
  ```

---

## Titkok és biztonság

| Változó | Hol elérhető | Mire való |
|---------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Kliens + szerver | Supabase projekt URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kliens + szerver | Supabase publikus anon kulcs |
| `SUPABASE_SERVICE_ROLE_KEY` | **Csak szerver** | Admin API route-ok (riportok, adatmódosítás) |
| `AI_PROVIDER` | Szerver (opcionális) | `openai` (default) vagy `claude` – melyik AI provider hívódjon |
| `OPENAI_API_KEY` | **Csak szerver** | AI szöveg generálás (OpenAI provider esetén) |
| `OPENAI_API_URL` | Szerver (opcionális) | Default: `https://api.openai.com/v1/chat/completions` |
| `OPENAI_MODEL` | Szerver (opcionális) | Default: `gpt-4.1-mini` |
| `ANTHROPIC_API_KEY` | **Csak szerver** | AI szöveg generálás (Claude provider esetén) |
| `CLAUDE_MODEL` | Szerver (opcionális) | Default: `claude-sonnet-4-6` |

- `.env.local` soha nem kerülhet git-be (`.gitignore`-ban van)
- `NEXT_PUBLIC_` prefix nélküli változók csak szerver oldalon érhetők el
- A `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` és `ANTHROPIC_API_KEY` nincs benne a `.env.local.example`-ben – manuálisan kell beállítani
- Provider váltáshoz: `.env.local`-ban `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` megadása elegendő
- RLS engedélyezve: `standings`, `game_text_reports`, `team_text_reports`. SELECT: bejelentkezett felhasználók; INSERT/UPDATE/DELETE: csak `service_role`.

---

## Scraping CLI szkriptek

CLI szkriptek a gyökérszinten (tsx-szel futtatva):
```bash
npm run hunbasket:import    # Teljes szezon import
npm run hunbasket:rosters   # Csapatnévsor
npm run hunbasket:fixtures  # Mérkőzésnaptár
npm run hunbasket:shotchart # Shot chart
npm run hunbasket:pbp       # Play-by-play
npm run kosarstat:pbp       # Kosarstat PBP
```

Konvenciók:
- `browser.close()` mindig `finally` blokkban
- `dotenv` a `.env.local` betöltéséhez
- Minden szkript naplózza a progresszt (`console.log`) és a hibákat (`console.error`)

---

## Kommunikáció

Tömören kommunikálok. Minden változás után jelzem:
- Mit módosítottam és melyik fájlban
- Ha szükséges SQL migráció, jelzem hogy kézzel kell futtatni
- Ha új package kellene, megkérdezem
- Ha új design tokent vagy animációt vezetnék be, megkérdezem
- Ha egy stílus-feladat funkcionális változtatást igényelne, jelzem és külön döntést kérek
- Ha `context/progress-tracker.md`-t frissítettem
- A részműveletek és a műveletek végén a Backlog.md fájlt frissítsd, hogy mindig a legaktuálisabb legyen minden.
