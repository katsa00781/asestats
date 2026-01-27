-- Ellenőrizzük, vannak-e árva statisztikák (player_id már nem létezik a players táblában)
SELECT 
  pss.*
FROM player_season_stats pss
LEFT JOIN players p ON pss.player_id = p.id
WHERE p.id IS NULL;  -- Árva rekordok, ahol a játékos már nem létezik

-- Ha vannak árva statisztikák, ezek valószínűleg Darthard és Huszár statisztikái
