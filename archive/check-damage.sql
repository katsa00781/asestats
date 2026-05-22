-- GYORS DAMAGE ASSESSMENT

-- 1. Hány meccs maradt?
SELECT COUNT(*) as remaining_games
FROM games g
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026';

-- 2. Hány player_game_stats maradt?
SELECT COUNT(*) as remaining_player_stats
FROM player_game_stats pgs
JOIN games g ON pgs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
WHERE s.name = '2025/2026';

-- 3. SUPABASE - Van-e backup? Ellenőrizd a Time Travel funkciót!
-- Dashboard → Database → Backups
-- VAGY SQL szinten:

-- 4. Próbáljuk visszaállítani egy órával korábbról (ha van point-in-time recovery)
-- Ez NEM fog működni SQL-ből, a Supabase Dashboard-on kell!
