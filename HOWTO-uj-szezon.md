# HOWTO: Új szezon hozzáadása

Minden bajnoki szezon elején el kell végezni az alábbi lépéseket. A folyamat két részből áll: SQL migráció és kód módosítás.

---

## 1. SQL migráció – új szezonspecifikus tábla

Hozz létre egy új fájlt `migrations/` mappában, pl. `add-player-game-stats-2026-2027.sql`:

```sql
-- Új szezonspecifikus statisztikatábla: 2026/2027
CREATE TABLE IF NOT EXISTS player_game_stats_2026_2027 (
  LIKE player_game_stats_2025_2026 INCLUDING ALL
);

ALTER TABLE player_game_stats_2026_2027
  ADD CONSTRAINT fk_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON player_game_stats_2026_2027 TO authenticated;
GRANT SELECT ON player_game_stats_2026_2027 TO anon;
```

> **Megjegyzés:** A legegyszerűbb a `LIKE ... INCLUDING ALL` forma, ami minden oszlopot, indexet és megszorítást lemásol az előző szezon táblájából. Az FK-kat explicit újra kell adni, mert azokat a `LIKE` nem örökíti.

**Futtasd le** a Supabase SQL Editorban (nem a kódból!).

---

## 2. A UNION view frissítése

A meglévő `player_game_stats` UNION view-t is bővíteni kell az új táblával. Fűzd hozzá a `migrations/split-player-game-stats-by-season.sql` mintájára az UNION ágat:

```sql
-- A player_game_stats view-ban add hozzá:
UNION ALL
SELECT * FROM player_game_stats_2026_2027
```

Ezt szintén a Supabase SQL Editorban kell futtatni, mert a view-t újra kell definiálni `CREATE OR REPLACE VIEW` formában.

---

## 3. `lib/season-tables.ts` – mapping bővítése

Nyisd meg [lib/season-tables.ts](lib/season-tables.ts) és add hozzá az új szezont:

```ts
export const SEASON_STATS_TABLES: Record<string, string> = {
  '2023/2024': 'player_game_stats_2023_2024',
  '2024/2025': 'player_game_stats_2024_2025',
  '2025/2026': 'player_game_stats_2025_2026',
  '2026/2027': 'player_game_stats_2026_2027',  // ← új sor
} as const;
```

---

## 4. Új szezon felvétele a `seasons` táblába

A Supabase SQL Editorban vagy az adminfelületen add hozzá a szezont:

```sql
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2026/2027', '2026-09-01', '2027-06-30', true);

-- Az előző szezont állítsd inaktívra:
UPDATE seasons SET is_current = false WHERE name = '2025/2026';
```

---

## 5. Ellenőrzés

- Indítsd el a dev szervert: `npm run dev`
- Nyisd meg a dashboardot, válaszd ki az új szezont a SeasonSelector-ban
- Ellenőrizd, hogy a játékosnézetek helyesen töltődnek be (üres lista az elvárt – még nincsenek meccsek)
- Futtasd az első kör importját: `npm run hunbasket:import`

---

## Összefoglaló checklist

- [ ] SQL: `player_game_stats_2026_2027` tábla létrehozva (Supabase SQL Editor)
- [ ] SQL: `player_game_stats` UNION view frissítve (Supabase SQL Editor)
- [ ] SQL: új sor a `seasons` táblában, előző szezon `is_current = false`
- [ ] Kód: `lib/season-tables.ts` bővítve
- [ ] Teszt: dev szerver és SeasonSelector ellenőrzés
