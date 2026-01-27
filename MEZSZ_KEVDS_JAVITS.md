# Mezszám Keveredés Javítása - Teendők

## A probléma
A `players` tábla `UNIQUE(number)` constraint-je miatt ugyanaz a mezszám nem lehet többször az adatbázisban. Ha 2024/2025-ben volt egy #7-es játékos és 2025/2026-ban is van, akkor **ugyanaz a player rekord mindkét szezonhoz kapcsolódik**, ezért keverednek a játékosok.

## Megoldás
A játékosokat is **szezon-specifikussá** tesszük: `players.season_id` + `UNIQUE(number, season_id)`

## Lépések

### 1. Futtasd le a migrációt: `add-season-to-players.sql`

```sql
-- 1. Season_id hozzáadása
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE CASCADE;

-- 2. Régi UNIQUE constraint törlése
ALTER TABLE players 
  DROP CONSTRAINT IF EXISTS players_number_key;

-- 3. Új UNIQUE constraint: (number, season_id)
ALTER TABLE players
  ADD CONSTRAINT players_number_season_unique UNIQUE (number, season_id);

-- 4. Index létrehozása
CREATE INDEX IF NOT EXISTS idx_players_season_id ON players(season_id);

-- 5. Meglévő játékosok → jelenlegi szezon
UPDATE players 
SET season_id = (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
WHERE season_id IS NULL;

-- 6. Season_id kötelezővé tétele
ALTER TABLE players
  ALTER COLUMN season_id SET NOT NULL;
```

### 2. Futtasd le a frissített view-t: `add-season-support.sql` (58-107. sor)

```sql
-- A view most már a players.season_id-t is használja
CREATE OR REPLACE VIEW player_season_stats_by_season
...
FROM 
  players p
  INNER JOIN seasons s ON p.season_id = s.id  -- ÚJ SOR!
  INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
  INNER JOIN games g ON pgs.game_id = g.id AND g.season_id = s.id
...
```

### 3. Adatok ellenőrzése

```sql
-- Játékosok szezon szerint
SELECT 
  s.name as season_name,
  COUNT(DISTINCT p.id) as player_count,
  COUNT(DISTINCT p.number) as unique_numbers
FROM players p
JOIN seasons s ON p.season_id = s.id
GROUP BY s.name
ORDER BY s.start_date DESC;
```

### 4. Frontend frissítése

A `JsonImport.tsx` már frissítve van, hogy:
- Játékos keresése: `.eq('season_id', selectedSeasonId)`
- Új játékos beszúrása: `season_id: selectedSeasonId`

### 5. Tesztelés

1. **Frissítsd a böngészőt** (F5 vagy Cmd+R)
2. **Válts a 2025/2026 szezonra**
   - Ellenőrizd, hogy csak az idei játékosok jelennek meg
3. **Válts a 2024/2025 szezonra**
   - Ellenőrizd, hogy csak a tavalyi játékosok jelennek meg
4. **Import teszt**: próbálj meg egy új meccset importálni
   - A játékosokat a kiválasztott szezonhoz kell rendelni

## Várható eredmény

✅ Minden játékos csak egy szezonban jelenik meg
✅ Ugyanaz a mezszám létezhet több szezonban is (különböző játékosok)
✅ Import során a játékosok automatikusan a kiválasztott szezonhoz kerülnek
✅ Nincs keresztszennyeződés a szezonok között

## Ha problémát tapasztalsz

1. Ellenőrizd a böngésző konzolt (F12 → Console)
2. Ellenőrizd, hogy mindkét migráció lefutott-e hiba nélkül
3. Futtasd le az ellenőrző SQL query-ket
