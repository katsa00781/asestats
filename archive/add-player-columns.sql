-- Hozzáadjuk a hiányzó oszlopokat a players táblához

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS birth_year INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS weight INTEGER;

-- Frissítjük a position oszlop hosszát, hogy elférjenek a magyar fordítások
ALTER TABLE players 
ALTER COLUMN position TYPE VARCHAR(100);
