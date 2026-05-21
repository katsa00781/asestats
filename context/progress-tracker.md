# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Aktív fejlesztés – meglévő funkcionalitás optimalizálása és bővítése

## Current Goal

- Context fájlok elkészítve; következő fejlesztési egység meghatározandó

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

- (Nincs aktív fejlesztési egység)

## Completed (legutóbbi)

- **player_game_stats szezonos szétválasztás** (2026-05-21):
  - Létrehozva: `player_game_stats_2023_2024`, `player_game_stats_2024_2025`, `player_game_stats_2025_2026` táblák
  - Migráció SQL: `migrations/split-player-game-stats-by-season.sql` (Supabase SQL Editorban futtatandó)
  - Visszafelé kompatibilis UNION view `player_game_stats` névvel + INSTEAD OF trigger routing
  - Új helper: `lib/season-tables.ts` (táblanév mapping, `getSeasonStatsTable`, `ALL_SEASON_STATS_TABLES`)
  - `app/page.tsx`: szűretlen cross-season lekérdezés → szezonspecifikus táblákra bontva (1000 soros limit elkerülése)
  - `player_season_stats_by_season` view újraírva, közvetlenül a szezon-specifikus táblákból aggregál

## Next Up

- Meghatározandó a következő fejlesztési egység a felhasználóval való egyeztetés alapján

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

## Session Notes

- A kontextus fájlok 2026-05-11-én készültek el a meglévő CLAUDE.md és projekt vizsgálata alapján
- A projekt repository: https://github.com/katsa00781/asestats (privát)
- Folytatáshoz: olvasd el az összes kontextus fájlt sorban, majd kérdezd meg a felhasználót, mi a következő fejlesztési egység
