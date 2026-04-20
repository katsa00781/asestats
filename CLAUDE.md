# ASEStats – Claude Code útmutató

## A projekt célja

Magyar kosárlabda statisztikai és elemzési platform. Adatokat gyűjt a Hunbasket.hu és Kosarstat.hu oldalakról, tárolja Supabase-ben, és egy Next.js dashboardon jeleníti meg. A rendszer kezeli a mérkőzések előtti (pregame scouting) és utáni (postgame) elemzéseket is, szöveges riportokat generál.

---

## Tech stack

| Réteg | Technológia |
|-------|-------------|
| Frontend framework | Next.js 16 (App Router), React 19 |
| Nyelv | TypeScript 5 – strict mode |
| Adatbázis | Supabase (PostgreSQL) |
| Stílus | Tailwind CSS 4, shadcn/ui (New York stílus), Radix UI |
| Ikonok | Lucide React |
| Chartok | Chart.js + react-chartjs-2, Recharts |
| Scraping | Playwright (headless browser) |
| Script futtatás | tsx (TypeScript Node executor) |
| Linter | ESLint 9 (next/core-web-vitals konfig) |

---

## TypeScript beállítások (`tsconfig.json`)

- **Target:** ES2017
- **Module resolution:** `bundler` (Next.js-optimalizált)
- **Strict mode:** be van kapcsolva
- **Path alias:** `@/*` → projekt gyökerére mutat (pl. `@/lib/supabase`, `@/components/GameLog`)
- **JSX:** `react-jsx`
- **Incremental build:** engedélyezve

---

## Mappa struktúra

```
/app
├── api/                        # API route-ok (Next.js App Router)
│   ├── hunbasket-*/            # Hunbasket scraping és import endpointok
│   ├── kosarstat-pbp-*/        # Kosarstat play-by-play importok
│   ├── eurobasket-*/           # Eurobasket játékosadatok
│   └── generate-*-text/        # AI szöveges riport generálás
├── globals.css                 # Globális Tailwind stílusok
├── layout.tsx                  # Root layout (auth provider, toaster)
└── page.tsx                    # Fő dashboard oldal

/components                     # React komponensek
├── ui/                         # shadcn/ui alapkomponensek (button, card, tabs…)
├── *Import.tsx                 # Adatimport komponensek (Hunbasket, Kosarstat…)
├── *Details.tsx                # Részletező nézetek (GameDetails, PlayerDetails)
├── *Management.tsx             # Kezelői felületek (GameManagement, PlayersManagement)
├── *Comparison.tsx             # Összehasonlítók (PlayerComparison, TeamComparison…)
├── GameLog.tsx                 # Mérkőzés előzmények
├── StandingsView.tsx           # Tabella nézet
└── LoginForm.tsx               # Bejelentkezés

/lib                            # Megosztott logika és segédeszközök
├── supabase.ts                 # Supabase kliens + teljes adatbázis TypeScript típusok
├── auth-context.tsx            # React auth context
├── player-analysis.ts          # Játékos statisztikai elemzés (~47KB)
├── team-analysis.ts            # Csapat statisztikai elemzés (~59KB)
├── pregame-scouting.ts         # Mérkőzés előtti elemzés (~82KB)
├── postgame-report.ts          # Mérkőzés utáni riport (~63KB)
├── player-postgame.ts          # Játékos postgame adatok
├── terminology.ts              # Kosárlabda terminológia (magyarul)
├── positions.ts                # Poszttérkép
├── style-vocabulary.ts         # Szöveggenerálás szókincse
└── utils.ts                    # Általános segédfüggvények

/scripts                        # Adatbázis migration és egyéb szkriptek
/migrations                     # Supabase SQL migrációs fájlok (29 db)
/public/data/                   # Statikus adatfájlok
```

Gyökérszintű `.ts` / `.js` fájlok scraping és adatfeldolgozó szkriptek:
- `scrape-hunbasket*.ts` – Hunbasket adatgyűjtés
- `scrape-kosarstat*.ts` – Kosarstat adatgyűjtés
- `process-hunbasket-*.ts` – Adatfeldolgozás
- `update-*.ts` – Adatfrissítők
- `check-*.ts` / `test-*.js` – Ellenőrzők és tesztek

---

## Kódolási konvenciók

### Elnevezések
- **Komponensek:** PascalCase (`GameDetails.tsx`, `PlayerComparison.tsx`)
- **Függvények / változók:** camelCase (`playerStats`, `calculateMetrics`)
- **Típusok / interfészek:** PascalCase (pl. `Database`, `PlayerGameStats`)
- **Adatbázis mezők:** snake_case (`free_throw_made`, `player_game_stats`)
- **Konstansok:** UPPER_SNAKE_CASE (`SUPABASE_URL`, `HUNBASKET_SEASON_SLUG`)

### React minták
- `'use client'` direktíva minden olyan fájl tetején, amely hook-ot vagy böngészős API-t használ
- Server Components az alapértelmezés (layout, adatlekérés)
- State kezelés: `useState`, `useCallback`, `useEffect`, `useMemo`
- Globális auth állapot: `auth-context.tsx` context-en keresztül

### API route-ok
```ts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300  // scraping route-oknál
```

### Import sorrend
```ts
import type { ... } from '...'   // típus importok előre
import { ... } from '@/lib/...'  // belső, path alias
import { ... } from 'third-party' // külső csomagok
```

### Stílus
- Tailwind osztályok: `clsx` + `tailwind-merge` a kombináláshoz
- Komponens variánsok: Class Variance Authority (`cva`)
- CSS változók a témázáshoz (`globals.css`)

---

## Elérhető npm szkriptek

```bash
npm run dev                      # Dev szerver
npm run build                    # Produkciós build
npm run lint                     # ESLint futtatás

npm run hunbasket:import         # Teljes Hunbasket szezon import
npm run hunbasket:rosters        # Játékos névsort szinkronizál
npm run hunbasket:fixtures       # Mérkőzés-naptár import
npm run hunbasket:shotchart      # Shot chart adatok importja
npm run hunbasket:pbp            # Play-by-play import (Hunbasket)
npm run kosarstat:pbp            # Play-by-play import (Kosarstat)
```

---

## Környezeti változók (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Adatfolyam

```
Hunbasket.hu / Kosarstat.hu
        ↓ Playwright scraping
   scrape-*.ts szkriptek
        ↓
     Supabase (PostgreSQL)
        ↓
  /lib/*-analysis.ts logika
        ↓
  /components/*.tsx UI
        ↓
     Dashboard (page.tsx)
```

---

## Meglévő dokumentációs fájlok

| Fájl | Tartalom |
|------|----------|
| [README.md](README.md) | Alap setup + import leírás magyarul |
| [HOGYAN_FRISSITSD.md](HOGYAN_FRISSITSD.md) | Játékosadatok frissítése (SQL) |
| [TABELLA_IMPORT.md](TABELLA_IMPORT.md) | Tabella import magyarázat |
| [TEAMS_SUPPORT.md](TEAMS_SUPPORT.md) | Csapat konfiguráció |
| [SZEZON_MIGRACIÓ.md](SZEZON_MIGRACIÓ.md) | Szezon migrációs útmutató |
| [MECCS_ELEMZES.md](MECCS_ELEMZES.md) | Meccs elemzés leírás |
| [MEZSZ_KEVDS_JAVITS.md](MEZSZ_KEVDS_JAVITS.md) | MEZSZ KEVDS adatjavítások |
