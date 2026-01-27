-- Csapatnevek frissítése a 2024/2025-ös bajnokság állása alapján
-- Futtasd le a Supabase SQL Editor-ban

-- 1. Először töröljük a régi csapatokat (kivéve ASE-t, ami primary)
DELETE FROM teams WHERE is_primary = false;

-- 2. Új csapatok beszúrása a pontos nevekkel
INSERT INTO teams (name, short_name, is_primary) VALUES
  ('NHSZ-Szolnoki Olajbányász', 'Szolnok', false),
  ('Falco-Vulcano Energia KC Szombathely', 'Falco', false),
  ('Sopron KC', 'Sopron', false),
  ('Endo Plus Service-Honvéd', 'Honvéd', false),
  ('Egis Körmend', 'Körmend', false),
  ('DEAC', 'DEAC', false),
  ('Alba Fehérvár', 'Alba', false),
  ('Kometa-KVGY Kaposvári KK', 'Kaposvár', false),
  ('Duna Aszfalt-DTKH Kecskemét', 'Kecskemét', false),
  ('MVM-OSE Lions', 'OSE', false),
  ('Zalakerámia ZTE KK', 'ZTE', false),
  ('SZTE-Szedeák', 'Szedeák', false),
  ('NKA Universitas Pécs', 'Pécs', false)
ON CONFLICT (name) DO NOTHING;

-- 3. Ellenőrzés
SELECT 
  name, 
  short_name, 
  is_primary,
  created_at
FROM teams 
ORDER BY is_primary DESC, name;

-- 4. Csapatok száma
SELECT COUNT(*) as total_teams FROM teams;
