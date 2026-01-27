# Szezon Támogatás Migrációs Útmutató

## Áttekintés

Ez a migráció hozzáadja a több szezon támogatást az adatbázishoz. Ezzel lehetővé válik:
- Több szezon adatainak tárolása (pl. 2023/2024, 2024/2025)
- Korábbi szezonok adatainak importálása
- Szezonok közötti összehasonlítás
- Automatikus szűrés a jelenlegi szezonra

## Fontos változások

### 1. Új `seasons` tábla
- `id`: UUID, elsődleges kulcs
- `name`: Szezon neve (pl. "2024/2025")
- `start_date`: Szezon kezdete
- `end_date`: Szezon vége
- `is_current`: Csak egy szezon lehet jelenlegi egyszerre

### 2. Módosított `games` tábla
- Új `season_id` mező: UUID, foreign key a `seasons` táblára
- Minden meccs egy szezonhoz tartozik

### 3. Új `player_season_stats_by_season` view
- Szezon-specifikus aggregált statisztikák
- Group by `season_id`
- Tartalmazza a szezon nevét és is_current értékét

### 4. Módosított `player_season_stats` view
- Csak a jelenlegi szezon statisztikáit jeleníti meg
- Visszafelé kompatibilis a meglévő kóddal

## Migrációs lépések

### 1. SQL futtatása Supabase-ben

**FONTOS:** A migráció először törli, majd újra létrehozza a `player_season_stats` view-t. Ez azért szükséges, mert nem lehet módosítani egy létező view-t úgy, hogy új oszlopokat adjunk hozzá.

1. Jelentkezz be a Supabase dashboardra
2. Navigálj a projektedhez
3. Menj a **SQL Editor** menüpontra
4. Nyisd meg a `migrations/add-season-support.sql` fájlt
5. Másold be a teljes SQL kódot
6. Futtasd le az **"RUN"** gombbal

**Megjegyzés:** Ha hibát kapsz a view törlésével kapcsolatban, akkor:
- Először ellenőrizd, hogy nincs-e más view vagy függvény, ami hivatkozik rá
- Ha van, akkor azokat is törölni kell először, majd újra létrehozni

### 2. Ellenőrzés

**FONTOS:** Először futtasd le a `migrations/check-and-fix-season.sql` scriptet az adatbázis állapotának ellenőrzésére és javítására!

Futtasd le ezeket a query-ket az ellenőrzéshez:

```sql
-- 1. Ellenőrizd, hogy létrejött-e a seasons tábla és milyen szezonok vannak
SELECT * FROM seasons ORDER BY start_date DESC;

-- Várt eredmény: 2025/2026 szezon, is_current = true

-- 2. Ha a szezon neve nem megfelelő, vagy nincs is_current beállítva:
UPDATE seasons 
SET is_current = true 
WHERE name = '2025/2026';

-- 3. Ellenőrizd, hogy a games táblában van-e season_id
SELECT id, date, opponent, season_id FROM games LIMIT 5;

-- Várt eredmény: Minden meccsnél látható a season_id

-- 3. Teszteld a player_season_stats_by_season view-t
SELECT 
  player_id, 
  name, 
  season_name, 
  games_played, 
  total_points 
FROM player_season_stats_by_season 
LIMIT 5;

-- Várt eredmény: Játékosok statisztikái szezon névvel

-- 4. Teszteld a player_season_stats view-t (most csak jelenlegi szezon)
SELECT 
  player_id, 
  name, 
  games_played, 
  total_points 
FROM player_season_stats 
LIMIT 5;

-- Várt eredmény: Ugyanazok a játékosok, mint a jelenlegi szezonban
```

### 3. Frontend ellenőrzés

1. **Indítsd el a dev szervert:**
   ```bash
   npm run dev
   ```

2. **Ellenőrizd a szezon választót:**
   - A főoldalon felül látható a "Szezon" dropdown
   - "2024/2025 (Jelenlegi)" legyen kiválasztva
   - Az adatok ugyanúgy betöltődnek, mint eddig

3. **Ellenőrizd az összehasonlítás funkciót:**
   - Kattints az "Összehasonlítás" tabra
   - Válassz ki egy játékost
   - Válassz ki két szezont
   - (Jelenleg csak 1 szezon van, később több lesz)

## Korábbi szezon importálása

### 1. Új szezon létrehozása

**Gyors megoldás:** Futtasd le a `migrations/add-previous-seasons.sql` fájlt a Supabase SQL Editor-ban. Ez létrehozza:
- 2024/2025 szezon
- 2023/2024 szezon  
- 2022/2023 szezon

**Vagy manuálisan:**

```sql
-- Példa: 2023/2024 szezon létrehozása
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2023/2024', '2023-09-01', '2024-06-30', false);
```

### 2. Korábbi meccsek importálása

Amikor korábbi szezon meccseit importálod:
1. Győződj meg róla, hogy létezik a megfelelő szezon a `seasons` táblában
2. Az import során add meg a `season_id`-t:

```sql
-- Példa meccs beszúrás korábbi szezonba
INSERT INTO games (date, opponent, home_away, our_score, opp_score, result, season_id)
VALUES (
  '2024-01-15',
  'Ellenféljáték',
  'home',
  85,
  78,
  'W',
  (SELECT id FROM seasons WHERE name = '2023/2024')
);
```

### 3. Játékos statisztikák importálása

A `player_game_stats` táblába ugyanúgy importálhatsz, mint eddig:
- A `season_id` automatikusan a `games.season_id` alapján lesz hozzárendelve
- A view-k automatikusan szűrik a megfelelő szezonra

## Visszaállítás (ha szükséges)

Ha valami probléma van, így állíthatod vissza:

```sql
-- 1. Töröld a season_id oszlopot a games táblából
ALTER TABLE games DROP COLUMN season_id;

-- 2. Töröld a seasons táblát
DROP TABLE seasons CASCADE;

-- 3. Állítsd vissza az eredeti player_season_stats view-t
-- (Másold be az eredeti kódot a supabase-schema.sql-ből)
```

## További teendők

- [ ] SQL migráció futtatása Supabase-ben
- [ ] Ellenőrzési query-k futtatása
- [ ] Frontend tesztelés
- [ ] Korábbi szezon (2023/2024) létrehozása
- [ ] Korábbi meccsek importálása
- [ ] Összehasonlítás funkció tesztelése több szezonnal

## Támogatás

Ha problémába ütközöl:
1. Ellenőrizd a Supabase logs-ot
2. Futtasd le az ellenőrzési query-ket
3. Nézd meg a browser console-t hibákért
