-- HUSZáR 0-s statisztikái valójában Darthard-é
-- Átadjuk a statisztikákat Darthard-nak (player_game_stats táblában)

-- 1. Statisztikák átadása Darthard-nak a game stats táblában
UPDATE player_game_stats 
SET player_id = '64391e87-dd62-4359-ad53-b4287babe588'  -- Darthard ID
WHERE player_id = '7573679f-a041-43a7-a58d-ef5bc930b108';  -- HUSZáR 0-s ID

-- 2. Töröljük a 0-s HUSZáR duplikátumot
DELETE FROM players WHERE id = '7573679f-a041-43a7-a58d-ef5bc930b108';

-- 3. Töröljük a 97-es HUSZáR duplikátumot is
DELETE FROM players WHERE id = '04c4f0e2-050b-4714-9ad2-e781cfe726ee';
