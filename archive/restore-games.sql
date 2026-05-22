-- HELYREÁLLÍTÁS: Visszarakjuk a games rekordokat a player_game_stats alapján!

-- 1. ELLENŐRZÉS: Van-e még player_game_stats adat?
SELECT COUNT(*) as orphan_player_stats
FROM player_game_stats pgs
LEFT JOIN games g ON pgs.game_id = g.id
WHERE g.id IS NULL;

-- 2. EGYEDI GAME_ID-k a player_game_stats-ból
-- Ezeket kell újra létrehozni a games táblában
SELECT 
  pgs.game_id,
  MIN(pgs.created_at) as game_date,
  COUNT(*) as player_count
FROM player_game_stats pgs
LEFT JOIN games g ON pgs.game_id = g.id
WHERE g.id IS NULL
GROUP BY pgs.game_id
ORDER BY MIN(pgs.created_at) DESC;

-- 3. PROBLÉMA: A games táblában nincs adat, amit vissza tudnánk állítani!
-- Hiányzik: date, our_team_id, opponent, our_score, opp_score, season_id...

-- MEGOLDÁS: SUPABASE BACKUP RESTORE!
-- Menj ide: https://app.supabase.com → Project → Database → Backups
-- Válassz ki egy backup-ot 1-2 órával ezelőttről
-- Restore to a new project VAGY Point-in-time recovery (ha van)
