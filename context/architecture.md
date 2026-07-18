# Architecture Context

## Stack

| Réteg | Technológia | Szerepe |
|-------|-------------|---------|
| Framework | Next.js 16 (App Router) + TypeScript 5 | Full-stack React framework, SSR és API route-ok |
| UI könyvtár | React 19 | Komponens-alapú UI réteg |
| Nyelv | TypeScript 5 – strict mode | Típusbiztonság az egész kódbázisban |
| Stílus | Tailwind CSS 4 + shadcn/ui (New York) + Radix UI | Utility-first CSS, előre épített komponensek |
| Adatbázis | Supabase (PostgreSQL) | Centrális adattárolás, RLS, View-ok |
| Auth | Supabase Auth (email/jelszó) | Bejelentkezés és munkamenet-kezelés |
| Chartok | Chart.js + react-chartjs-2, Recharts | Statisztikai vizualizáció |
| Ikonok | Lucide React | SVG ikonkönyvtár |
| Scraping | Playwright (headless browser) | Hunbasket.hu és Kosarstat.hu adatgyűjtés |
| Script runner | tsx | TypeScript fájlok futtatása Node.js-ben |
| Animációk | tw-animate-css | Tailwind animáció segédkönyvtár |
| Toast | Sonner | Értesítési toast komponens |
| Linter | ESLint 9 (next/core-web-vitals) | Kódminőség ellenőrzés |
| Képek | Eurobasket.com domain engedélyezve | Játékos fotók remotPatterns-ben |

## System Boundaries

- `app/` — Next.js App Router: oldalak (page.tsx, layout.tsx), API route-ok, globális CSS
- `app/api/` — API route-ok: scraping endpointok, AI riport generálás, import műveletek; minden route `force-dynamic`
- `components/` — React UI komponensek; `components/ui/` a shadcn/ui alapkomponensek (NEM szerkesztendő kézzel)
- `lib/` — Megosztott logika: Supabase kliens, auth context, statisztikai elemzési függvények, terminology
- `migrations/` — Supabase SQL migrációs fájlok; **csak** Supabase SQL Editor-ban vagy `scripts/run-sql.sh`-val futtatni
- `scripts/` — Adatbázis migration szkriptek és egyéb Node.js segédeszközök
- `public/` — Statikus fájlok (SVG ikonok, statikus JSON adatok)
- Gyökérszintű `*.ts` / `*.js` fájlok — Scraping és adatfeldolgozó CLI szkriptek (nem Next.js részei)

## Storage Model

- **Supabase PostgreSQL** (elsődleges adattár):
  - `games` — mérkőzések (dátum, ellenfél, eredmény, szezon, csapat); **UNIQUE (season_id, our_team_id, date)** – minden író erre a kulcsra upsertel (`migrations/add-games-unique-constraint.sql`); az `opponent` szabad szöveg, szándékosan NEM része a dedup kulcsnak
  - `players` — játékos alapadatok (név, szám, pozíció, szezon, csapat, aktív státusz); **partial unique index (season_id, team_id, lower(trim(name)))** (`migrations/add-players-unique-index.sql`) – a mezszám nem része a kulcsnak
  - `player_game_stats_YYYY_YYYY` — meccsenkénti játékos statisztikák szezononként külön táblában (`player_game_stats_2023_2024`, `player_game_stats_2024_2025`, `player_game_stats_2025_2026`); a `player_game_stats` UNION view INSTEAD OF triggerekkel biztosítja a visszafelé kompatibilitást; JS-kód `lib/season-tables.ts` segítségével érje el a helyes táblát
  - `seasons` — szezonok (id, név, start/end dátum)
  - `teams` — csapatok (id, név, rövid név, is_primary flag)
  - `league_fixtures` — bajnokság mérkőzésnaptár (hazai, vendég, dátum, kör, státusz)
  - `standings` — tabella adatok
  - `hunbasket_shotchart_raw` + `hunbasket_shot_events` — Hunbasket shot chart nyers oldalak és dobás-események; koordináta-konvenció: 0–100-as skála, normalizálás után minden dobás a bal palánk felé támad, a kosár (x≈6, y=50)
  - `kosarstat_game_pages_raw` + `kosarstat_game_page_tables` + `kosarstat_game_quarter_stats` + `kosarstat_game_team_metrics` — Kosarstat play-by-play nyers oldalak és kinyert statisztikák; a `games.kosarstat_game_id` linkeket az import automatikusan írja (dátum + csapatnév match)
  - `game_text_reports` — AI által generált pregame/postgame szöveges riportok
  - Views: `player_season_stats_by_season` — aggregált szezon statisztikák mező-szintű összesítéssel

- **Statikus adatok** (`public/data/`):
  - `games.json` — historikus meccsadatok (fallback / archív célra)

- **Környezeti változók** (`.env.local`, soha ne kerüljön verziókövetésbe):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Auth and Access Model

- Minden felhasználó Supabase email/jelszó autentikációval jelentkezik be
- Az `AuthProvider` (`lib/auth-context.tsx`) React Context-en keresztül biztosítja a `user`, `loading`, `signOut` állapotokat az egész alkalmazásnak
- A `page.tsx` root szinten guard-olja a hozzáférést: ha `!user`, csak `<LoginForm />` jelenik meg
- A Supabase RLS (Row-Level Security) a `standings`, `game_text_reports`, `team_text_reports` táblákon engedélyezve; más tábláknál a kliens oldali guard véd
- **Minden API route auth-guardolt**: a `lib/api-auth.ts` `requireAuth()` a bejövő `Authorization: Bearer <access_token>` fejlécet validálja a service kliensen (`auth.getUser`); kliens oldalon a `lib/api-fetch.ts` `authFetch()` csatolja a tokent
- Nincs szerepkör-alapú hozzáférés-vezérlés (RBAC); minden bejelentkezett felhasználó teljes hozzáféréssel rendelkezik

## Data Flow

```
Hunbasket.hu / Kosarstat.hu
        ↓ Playwright scraping
   scrape-*.ts CLI szkriptek (közös segédek: scrape-utils.ts)
   ├─ kézzel: npm run hunbasket:* / kosarstat:pbp
   ├─ ütemezve: .github/workflows/scrape.yml (GitHub Actions cron)
   └─ UI-ból: app/api/hunbasket-*/ (lib/run-script.ts spawn wrapper –
      CSAK hosszú életű Node processen működik, serverless-en NEM)
        ↓
     Supabase (PostgreSQL)
     games, players, player_game_stats_*, etc.
        ↓
  /lib/*-analysis.ts logika
  (player-analysis, team-analysis, pregame-scouting, postgame-report;
   közös formulák: lib/stat-formulas.ts)
        ↓
  /components/*.tsx UI
        ↓
     Dashboard (app/page.tsx)
```

## Invariants

1. **Csak bejelentkezett felhasználók férnek hozzá az adatokhoz** — a `page.tsx` mindig ellenőrzi az auth állapotot, mielőtt bármilyen adat megjelenik
2. **`components/ui/` fájlok nem módosíthatók kézzel** — ezek shadcn/ui generált komponensek; módosításhoz a shadcn CLI-t kell használni (`npx shadcn@latest add`)
3. **`migrations/` SQL fájlok nem futtathatók közvetlenül a kódbázisból** — kizárólag Supabase SQL Editor-ban vagy `scripts/run-sql.sh`-n keresztül kerülnek végrehajtásra
4. **Minden adatlekérdezés szezon (`season_id`) és csapat (`team_id`) szerint szűrt** — nyers, szűretlen query a teljes adatbázisra nem engedélyezett a fő dashboardon; ahol egy lekérdezés 1000 sor fölé nőhet, a `lib/fetch-all-rows.ts` lapozó helpert KELL használni (a PostgREST némán csonkol 1000 sornál)
5. **API route-ok `export const dynamic = 'force-dynamic'` direktívával vannak ellátva** — a scraping és import endpointokon soha nem lehet cachelés
6. **A Supabase kliens egyetlen példányként létezik** (`lib/supabase.ts`) — nem szabad több Supabase klienst létrehozni különböző fájlokban
7. **Scraping szkriptek csak gyökérszintű `.ts` fájlokban vagy `app/api/` route-okban futnak** — komponensekből vagy `lib/`-ből közvetlenül nem hívható Playwright
8. **TypeScript strict mode mindig be van kapcsolva** — `any` típus nem használható; minden külső adat interfészen vagy narrowing-on keresztül kerül felhasználásra
9. **A games/players írások a DB dedup-kulcsokra upsertelnek** — games: `(season_id, our_team_id, date)`; players: név-alapú partial unique index; új író kód nem térhet el ezektől a kulcsoktól
10. **A kanonikus stat-formulák a `lib/stat-formulas.ts`-ben élnek** — TS%/eFG%/valuation képletet tilos újra implementálni; a százalékok mindig összegzett dobásokból számolódnak, nem meccsenkénti százalékok átlagából
