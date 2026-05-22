# CLAUDE.md – ASEStats Projekt

## Szerepköröm

Senior full-stack fejlesztő vagyok ezen a projekten. Ismerem az architektúrát, az adatbázis sémát, a scraping logikát és az UI konvenciókat. Inkrementálisan dolgozom: egyszerre egy feature unit, kicsi ellenőrizhető változások. Nem kombinálok összefüggéstelen rendszerhatárokat (pl. UI + migráció egyszerre). Architektúrális döntéseket nem hozok meg önállóan – megkérdezem a felhasználót.

A részletes context fájlok itt találhatóak, ezeket implementáció előtt el kell olvasni:
- `context/project-overview.md` – termékdefiníció, scope
- `context/architecture.md` – rendszerhatárok, storage modell, invariánsok
- `context/ui-context.md` – téma, színek, komponens konvenciók
- `context/code-standards.md` – implementációs szabályok
- `context/ai-workflow-rules.md` – workflow és scoping szabályok
- `context/progress-tracker.md` – jelenlegi állapot, következő lépések

---

## Projekt áttekintés

**ASEStats** – Magyar kosárlabda statisztikai és elemzési platform az ASE (Atomerőmű SE) kosárlabdacsapat belső használatára. Az alkalmazás:
- Automatikusan gyűjt mérkőzés-adatokat Hunbasket.hu-ról és Kosarstat.hu-ról (Playwright scraping)
- Tárolja az adatokat Supabase (PostgreSQL) adatbázisban
- Next.js dashboardon jeleníti meg szezon/csapat szűréssel
- AI-alapú pregame scouting és postgame elemzési szöveges riportokat generál (OpenAI)
- Bejelentkezés-védett, csak belső felhasználóknak

---

## Tech Stack

| Réteg | Technológia | Verzió |
|-------|-------------|--------|
| Framework | Next.js App Router | ^16.0.10 |
| UI | React | ^19.2.1 |
| Nyelv | TypeScript | ^5, strict mode |
| Stílus | Tailwind CSS | ^4 |
| Komponens könyvtár | shadcn/ui (New York stílus) + Radix UI | – |
| Adatbázis | Supabase (PostgreSQL) | @supabase/supabase-js ^2.93.1 |
| Auth | Supabase Auth (email/jelszó) | – |
| Chart | Chart.js + react-chartjs-2 | ^4.5.1 / ^5.3.1 |
| Chart | Recharts | ^3.4.1 |
| Ikonok | Lucide React | ^0.553.0 |
| Scraping | Playwright | ^1.58.0 |
| CLI script runner | tsx | ^4.20.6 |
| Toast | Sonner | ^2.0.7 |
| AI szöveg generálás | OpenAI API (gpt-4.1-mini alapértelmezett) | fetch-alapú |
| Linter | ESLint 9 (next/core-web-vitals) | ^9 |
| Animációk | tw-animate-css | ^1.4.0 |
| CSS utility | clsx + tailwind-merge (`cn()`) | – |
| CVA | class-variance-authority | ^0.7.1 |

---

## Mappastruktúra

```
asestats/
├── app/                        # Next.js App Router
│   ├── api/                    # API route-ok (minden route force-dynamic)
│   │   ├── eurobasket-player-import/   # Eurobasket.com játékos fotó/adat import
│   │   ├── game-text-report/           # Riport lekérés/mentés Supabase-be
│   │   ├── generate-game-text-report/  # Pregame/postgame riport generálás (OpenAI)
│   │   ├── generate-player-postgame-text/  # Játékos postgame szöveg (OpenAI)
│   │   ├── generate-player-season-text/    # Játékos szezonelemzés szöveg (OpenAI)
│   │   ├── generate-pregame-text/      # Pregame scouting szöveg (OpenAI)
│   │   ├── generate-team-analysis-text/    # Csapat elemzés szöveg (OpenAI)
│   │   ├── hunbasket-fixtures-import/  # Hunbasket mérkőzésnaptár import
│   │   ├── hunbasket-roster-import/    # Hunbasket csapatnévsor import
│   │   ├── hunbasket-round-import/     # Hunbasket kör import
│   │   ├── kosarstat-pbp-cleanup/      # Kosarstat PBP adatok törlése
│   │   └── kosarstat-pbp-import/       # Kosarstat play-by-play import
│   ├── favicon.ico
│   ├── globals.css             # Tailwind 4 import, CSS változók (shadcn/ui dark téma)
│   ├── layout.tsx              # Root layout: AuthProvider, Toaster, Geist fontok
│   └── page.tsx                # Főoldal: dashboard, auth guard, összes tab
├── components/                 # React UI komponensek
│   ├── ui/                     # shadcn/ui alapkomponensek – NE MÓDOSÍTSD kézzel
│   │   ├── badge.tsx, button.tsx, card.tsx, input.tsx
│   │   ├── label.tsx, select.tsx, tabs.tsx, textarea.tsx, tooltip.tsx
│   └── [Feature komponensek]   # Lásd lentebb
├── context/                    # Projekt spec és kontextus fájlok (nem kód)
│   ├── ai-workflow-rules.md
│   ├── architecture.md
│   ├── code-standards.md
│   ├── progress-tracker.md
│   ├── project-overview.md
│   └── ui-context.md
├── lib/                        # Megosztott logika, típusok, segédfüggvények
│   ├── auth-context.tsx        # AuthProvider + useAuth() hook
│   ├── player-analysis.ts      # Játékos trendek és elemzési logika
│   ├── player-postgame.ts      # Postgame játékos breakdown logika
│   ├── positions.ts            # Pozíció segédfüggvények
│   ├── postgame-report.ts      # Postgame riport adatstruktúra
│   ├── pregame-scouting.ts     # Pregame scouting riport logika
│   ├── season-tables.ts        # Szezonspecifikus táblanév mapping
│   ├── situational-analysis.ts # Szituációs elemzés logika
│   ├── style-vocabulary.ts     # AI riport stílusszótár
│   ├── supabase.ts             # Supabase kliens + Database típus definíció
│   ├── team-analysis.ts        # Csapat elemzési logika
│   ├── terminology.ts          # Kosárlabda terminológia szótár
│   └── utils.ts                # cn() utility (clsx + tailwind-merge)
├── migrations/                 # SQL migrációs fájlok – csak Supabase SQL Editorban futtatni
├── scripts/                    # Node.js adatbázis segédeszközök
├── public/                     # Statikus fájlok (SVG, games.json archív)
│   └── data/games.json
├── data/games.json             # Historikus meccsadatok (archív fallback)
├── [scrape-*.ts]               # Playwright CLI scraping szkriptek (gyökérszint)
├── [check-*.sql, fix-*.sql]    # Diagnosztikai és javító SQL szkriptek (gyökérszint)
├── .env.local                  # Titkos változók – soha ne kerüljön git-be
├── .env.local.example          # Sablon a szükséges változókhoz
├── next.config.ts              # Next.js konfiguráció (Eurobasket képek engedélyezve)
├── components.json             # shadcn/ui konfiguráció (New York stílus)
└── tsconfig.json               # TypeScript strict konfiguráció
```

### Főbb feature komponensek

| Komponens | Felelősség |
|-----------|-----------|
| `PlayersList.tsx` | Aggregált szezon statisztikák listája |
| `PlayerDetails.tsx` | Részletes játékos nézet, gameHistory, trendek |
| `PlayerComparison.tsx` | Játékos összehasonlítás (cross-season) |
| `PlayerTrends.tsx` | Trend chartok (Recharts) |
| `TeamStatistics.tsx` | Csapat szintű átlagok |
| `TeamComparison.tsx` | Csapat összehasonlítás |
| `SeasonComparison.tsx` | Szezon összehasonlítás |
| `GamesList.tsx` | Mérkőzések + közelgő fixtures |
| `GameLog.tsx` | Meccs előzmények részletes bontása |
| `GameDetails.tsx` | Egyedi meccs részletei |
| `SituationalAnalysis.tsx` | Hazai/vendég, nyert/veszített bontás |
| `StandingsView.tsx` | Tabella megjelenítő |
| `StandingsImport.tsx` | Tabella kézi import |
| `KosarstatPbpImport.tsx` | Kosarstat PBP import UI |
| `FixturesImport.tsx` | Mérkőzésnaptár import |
| `RosterImport.tsx` | Csapatnévsor import |
| `RoundImport.tsx` | Kör import |
| `GameQuickImport.tsx` | Gyors meccs import |
| `JsonImport.tsx` | Meccs statisztika kézi JSON import |
| `PlayersManagement.tsx` | Játékosok admin kezelése |
| `PlayersImport.tsx` | Játékos tömeges import |
| `GameManagement.tsx` | Meccsek törlése |
| `PostgameShotScatterChart.tsx` | Shot chart vizualizáció (Chart.js) |
| `PostgameZoneHeatmapChart.tsx` | Zóna heatmap (Chart.js) |
| `SeasonSelector.tsx` | Szezon választó |
| `TeamSelector.tsx` | Csapat választó |
| `LoginForm.tsx` | Bejelentkezési form |
| `Updates.tsx` | Frissítések nézet |

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
| `game_text_reports` | AI generált pregame/postgame riportok |
| `team_text_reports` | AI generált csapat szezon riportok |
| `player_season_stats_by_season` | **VIEW**: aggregált szezon statisztikák |

**Új szezon hozzáadásához**: bővíteni kell `lib/season-tables.ts` `SEASON_STATS_TABLES` mappinget ÉS egy SQL migrációt kell írni a `migrations/` mappába.

---

## Fejlesztési filozófia

- **Feature-by-feature**: egyszerre egy jól körülhatárolt fejlesztési egységen dolgozom
- **Server Components alapértelmezett**: `'use client'` csak ha böngésző API vagy hook szükséges
- **Egyszerű és olvasható kód**: ne keverj UI logikát, adatfeldolgozást és API hívásokat egy fájlban
- **Magyar UI, angol kód**: kommentek és dokumentáció magyarul, identifikátorok angolul
- **Inkrementális változások**: nagy spekulatív refaktorálás helyett kis, ellenőrizhető lépések

---

## Döntési szabályok

**Mit ne változtass engedély nélkül:**
- `components/ui/*` – shadcn/ui generált fájlok; csak `npx shadcn@latest add`-del módosítandó
- `migrations/*.sql` – Supabase SQL Editorban futtatandó, nem a kódbázisból
- `tsconfig.json` – strict mode beállítások nem módosíthatók
- `app/layout.tsx` – csak AuthProvider vagy font konfiguráció változásakor
- `.env.local` – soha nem módosítandó az implementáció részeként

**Mikor kérdezz rá:**
- Új npm csomag hozzáadása előtt
- Adatbázis séma módosítása előtt
- Architektúrális döntés előtt (pl. state kezelés módosítása)
- Ha egy követelmény nincs egyértelműen definiálva a context fájlokban

---

## UI szabályok

- **Téma**: sötét mód only (`dark` class a root `<div>`-en, `bg-slate-950`)
- **Komponens könyvtár**: shadcn/ui New York stílus – `components/ui/` mappából
- **Elérhető alapkomponensek**: `Button`, `Card`, `Input`, `Label`, `Select`, `Tabs`, `Textarea`, `Tooltip`, `Badge`
- **Új komponens**: `npx shadcn@latest add <component-name>` – soha ne kézzel írj `components/ui/`-ba
- **Ikonok**: Lucide React, stroke-alapú; inline: `h-4 w-4`, gomb: `h-4 w-4`, header: `h-6 w-6 sm:h-8 sm:w-8`
- **Toast**: Sonner – `import { toast } from 'sonner'` → `toast.success()` / `toast.error()`

---

## Styling szabályok

- **Tailwind CSS 4** utility osztályok mindig
- Osztály kombinálás: `cn()` helper (`lib/utils.ts`) – `clsx` + `tailwind-merge`
- Hardcoded hex szín nem megengedett – mindig CSS változó token vagy Tailwind osztály
- Komponens variánsokhoz: Class Variance Authority (`cva`) – `button.tsx` mintájára
- Egyedi CSS: csak `globals.css`-ben CSS változók definiálásakor

---

## State management

Nincs külső state manager. React 19 beépített hookok:
- `useState`, `useCallback`, `useEffect`, `useMemo` – lokális és oldal-szintű state
- Globális auth állapot: `useAuth()` hook (`lib/auth-context.tsx`)
- `app/page.tsx` monolitikus megközelítés – minden fő state és adatlekérés egy helyen

---

## TypeScript szabályok

- **strict mode** kötelező (`tsconfig.json`: `"strict": true`) – nem módosítható
- `any` típus tilos – explicit interfészek vagy narrowing
- Külső adatokat (Supabase válaszok, scraping) validálni kell a rendszerhatárokon
- Típus importok: `import type { ... }` – az importlista elejére
- Path alias: `@/lib/...`, `@/components/...` – relatív `../../` import nem megengedett
- Supabase sorok típusai: `lib/supabase.ts` `Database` típusból leszármaztatva

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
- Ha `context/progress-tracker.md`-t frissítettem
