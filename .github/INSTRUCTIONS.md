# ASE Stats – Project Instructions

## 1. Stack Overview
- **Framework**: Next.js 16 (App Router, `use client` components) with Tailwind-based UI primitives. `npm run dev` launches Turbopack.
- **Database**: Supabase (PostgreSQL + storage + auth). Access via `@supabase/supabase-js` client instantiated in `lib/supabase.ts` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
- **State/Data Flow**: Most screens pull data directly from Supabase (real tables + materialized views) and cache in React state.
- **Key Folders**:
  - `app/` – Next.js entry points (`page.tsx`, global layout/styles).
  - `components/` – Feature-specific UI (game import, player lists, standings, etc.).
  - `lib/` – Supabase client + shared utilities.
  - `data/`, `scripts/`, `sql` files – Legacy helpers and migration snippets.
  - `migrations/` – Hand-written SQL for schema changes.

## 2. Supabase Schema Essentials
- **Tables**
  - `games`: Core match metadata (`date`, `opponent`, `home_away`, `our_score`, `opp_score`, `result`, `round`, `season_id`, `our_team_id`). Many features query this table by season + team.
  - `players`, `player_game_stats`: Player roster and per-game stats.
  - `seasons`, `teams`, `standings`, and multiple views (`player_season_stats_by_season`, etc.) power selectors and dashboards.
- **Migrations**: SQL scripts in `migrations/` maintain schema (season support, team linkage, round column, view refreshes). Apply in chronological order when updating the DB.
- **Env Configuration**: `.env.local` must contain Supabase URL + anon key. Keep prod keys synced across environments.

## 3. Data Import Pipelines
1. **Quick Match Import (`components/GameQuickImport.tsx`)**
   - Paste raw match info (date, round, teams, score). Parser extracts fields.
   - Component auto-maps both hazai and vendég csapat to Supabase `teams` using normalized names/abbreviations; user can override via dropdowns.
   - Inserts/updates corresponding `games` rows for **both** teams in the selected season, preventing duplicates by checking `(season_id, our_team_id, date, opponent)`.
   - After success, emits `onImportComplete` so `JsonImport` can preload metadata.
2. **JSON/Table Import (`components/JsonImport.tsx`)**
   - Handles player stat tables for each team. Supports importing into an existing game or creating a new one if missing.
   - Carefully parses Edwin export formats (tab or line-based). Deletes old `player_game_stats` before re-inserting if user confirms.
3. **Manual Entry (`components/GameInput.tsx`)**
   - Used for edge cases or quick edits.
4. **Hunbasket Scraper (`scrape-hunbasket.ts`)**
  - Headless Playwright script that végigmegy a teljes szezon menetrendjén, letölti a statisztika táblákat mindkét csapathoz, és közvetlenül tölti a `games` + `player_game_stats` táblákat.
  - Futtatás: `npm run hunbasket:import` (előtte `npx playwright install chromium`). Alapértelmezés szerint az `x2526` szezon (2025/2026) importja történik, de `HUNBASKET_*` környezeti változókkal testre szabható.
  - A script automatikusan létrehozza a hiányzó csapatokat és játékosokat, majd kihagyja azokat a meccseket, amelyek már szerepelnek `(season_id, our_team_id, opponent, date)` alapján.

## 4. Working With Seasons & Teams
- Always select the active **season** in the top-level UI; selectors drive every data fetch.
- `SeasonSelector` auto-picks the `is_current` season but can be overridden.
- Team data loads from Supabase `teams` table; `TeamSelector` falls back to standings when necessary and auto-creates missing teams.
- Ensure new teams exist in Supabase before importing games/stats (use the admin UI or SQL scripts if needed).

## 5. Local Development Workflow
1. Copy `.env.local` (contains Supabase credentials) before running `npm run dev`.
2. Install deps with `npm install`.
3. Start dev server: `npm run dev` (Turbopack). Fix any runtime errors surfaced in terminal/browser.
4. For database inspection, use Supabase Studio or quick node scripts (see prior terminal commands using `createClient`).
5. When editing data-intensive components (GameQuickImport, JsonImport), mock Supabase responses or use a staging project to avoid polluting production data.

## 6. Testing & QA Tips
- After importing a game, verify both entries exist in `games` (`home` + `away`) and that `player_game_stats` rows match expectations.
- Use Supabase queries to detect duplicates (`date/opponent/team`). Scripts in `/scripts` can aid with migrations and data cleanup.
- Watch for parsing errors when source text deviates from the expected format; the UI surfaces validation issues with explicit error lists.

## 7. Common Pitfalls & Fixes
- **Team not recognized**: Update `teams` table with proper `name`/`short_name`. Quick import now normalizes diacritics and abbreviations, but truly unknown names still require manual mapping.
- **Duplicate matches**: Quick import prevents this, but historical data might contain duplicates. Use SQL scripts under `/migrations` (`check-duplicate-assignments.sql`, etc.) to find/fix.
- **Season mismatch**: Ensure `games.season_id` and `players.season_id` are set. Run provided SQL (`check-and-fix-season.sql`) when migrating data.
- **Standings import**: Keep `teams` table synced; standings view relies on consistent naming.

## 8. Useful Commands/Snippets
```bash
# Start dev server
npm run dev

# Run lint
npm run lint

# Quick Supabase query (example)
node -e "const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data } = await supabase.from('games').select('*').limit(5);
  console.log(data);
})();"
```

Keep this document updated when schema or workflows change so future iterations stay aligned with the actual system behavior.