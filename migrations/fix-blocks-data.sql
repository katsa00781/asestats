-- Frissítjük a meglévő blokk adatokat
-- A blocks mező értéke a blocks_given (kiosztott blokkok) alapján kell legyen

UPDATE player_game_stats
SET blocks = blocks_given
WHERE blocks = 0 AND blocks_given > 0;

-- Ellenőrizzük az eredményt
SELECT COUNT(*) as updated_records
FROM player_game_stats
WHERE blocks > 0;
