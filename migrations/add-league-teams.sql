-- Bajnokság csapatainak hozzáadása
-- Futtasd le a Supabase SQL Editor-ban

-- Töröljük a régi csapatokat (kivéve a primary csapatot)
DELETE FROM teams WHERE is_primary = false;

-- Új csapatok beszúrása a 2024/2025-ös szezon állása alapján
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

-- Ellenőrzés
SELECT name, short_name, is_primary 
FROM teams 
ORDER BY is_primary DESC, name;
