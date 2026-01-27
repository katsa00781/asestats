-- FIGYELEM! Ez a script egyesíti a duplikált játékosokat!
-- Futtasd le CSAK akkor, ha tisztában vagy vele mit csinál!

-- Példa: Szolnoki játékosok törlése, akik az ASE-nél is szerepelnek
-- A statisztikáik megmaradnak az ASE-s rekordon

BEGIN;

-- Ellenőrzés - melyik játékosokat érinti:
SELECT 
  p_delete.name,
  p_delete.number,
  'TÖRLENDŐ: ' || t_delete.name as from_team,
  'MEGTARTVA: ' || t_keep.name as to_team,
  (SELECT COUNT(*) FROM player_game_stats WHERE player_id = p_delete.id) as stats_to_move
FROM players p_delete
JOIN players p_keep ON 
  p_delete.name = p_keep.name 
  AND p_delete.number = p_keep.number
  AND p_delete.season_id = p_keep.season_id
JOIN teams t_delete ON p_delete.team_id = t_delete.id
JOIN teams t_keep ON p_keep.team_id = t_keep.id
WHERE 
  t_delete.name = 'NHSZ-Szolnoki Olajbányász'
  AND t_keep.name = 'ASE'
ORDER BY p_delete.name;

-- Ha rendben van, akkor töröld a megjegyzést (--) az alábbi sorokról:

-- -- 1. Holt Ryland Thomas - statisztikák áthelyezése
-- UPDATE player_game_stats 
-- SET player_id = '1bf65484-2828-4d51-a92f-ec8a65a319e1'
-- WHERE player_id = '11688c53-7cfc-4630-8514-07f394dd0596';
-- DELETE FROM players WHERE id = '11688c53-7cfc-4630-8514-07f394dd0596';

-- -- 2. HORVáTH Ákos - statisztikák áthelyezése  
-- UPDATE player_game_stats 
-- SET player_id = '20ad7177-3167-4e7d-8511-36bf5c9dfb16'
-- WHERE player_id = 'cf379f2d-e13a-4603-8206-618db7ae697e';
-- DELETE FROM players WHERE id = 'cf379f2d-e13a-4603-8206-618db7ae697e';

-- -- 3. Somogyi Ádám - statisztikák áthelyezése
-- UPDATE player_game_stats 
-- SET player_id = '24f6733d-6ef0-4d2f-8a34-ece812c51079'
-- WHERE player_id = '43e2874e-5f49-4d41-80d2-fb2dd06c6420';
-- DELETE FROM players WHERE id = '43e2874e-5f49-4d41-80d2-fb2dd06c6420';

-- -- 4. Vrabac Adin - statisztikák áthelyezése
-- UPDATE player_game_stats 
-- SET player_id = 'c60999bb-822e-4b57-9ed4-00d0102d2b0e'
-- WHERE player_id = 'e718fd04-b682-4e03-943a-b516f76fb94f';
-- DELETE FROM players WHERE id = 'e718fd04-b682-4e03-943a-b516f76fb94f';

COMMIT;
