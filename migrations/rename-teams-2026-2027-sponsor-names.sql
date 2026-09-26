-- =====================================================================
-- rename-teams-2026-2027-sponsor-names.sql
-- KÉZZEL FUTTATANDÓ a Supabase SQL Editorban! Egyszeri adatjavítás.
--
-- Cél: három klub teams.name mezője a 2026/2027-es (hunbasket tabella
-- szerinti) nevet kapja, ahogy a H3-ban a Honvéd is (BACKLOG H7):
--   MVM-OSE Lions                         → OSE Lions
--   SZTE-Szedeák                          → Délút-SZTE-Szedeák
--   Falco-Vulcano Energia KC Szombathely  → Falco KC Szombathely
--
-- Csak a név változik: az id és a short_name (OSE / Szedeák / Falco)
-- marad, így minden id-alapú hivatkozás (meccsek, keretek, igazolások,
-- menetrend) érintetlen. A games.opponent szöveg SZÁNDÉKOSAN nem változik:
-- az a meccs kori név, a párosítás az opponent_team_id-n megy.
--
-- Előfeltétel: a scrape-utils.ts alias névcsoportjai (commit f6fe00a) – a
-- scraperek a régi és az új nevet is ugyanarra a sorra oldják fel.
--
-- Biztonság: egy DO blokk = egy tranzakció; ha bármelyik sor nem az elvárt
-- állapotban van, vagy az új név foglalt, semmi nem módosul.
-- =====================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('8ef9f1fe-1b3d-4c2f-84c3-cc2ceae3b457'::uuid, 'MVM-OSE Lions', 'OSE Lions'),
      ('d96c2f28-d38e-4813-b35f-5ceab8749368'::uuid, 'SZTE-Szedeák', 'Délút-SZTE-Szedeák'),
      ('e4401f4a-e4bb-4ff4-b10f-48a8f7200c65'::uuid, 'Falco-Vulcano Energia KC Szombathely', 'Falco KC Szombathely')
    ) AS v(team_id, old_name, new_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = r.team_id AND name = r.old_name) THEN
      RAISE EXCEPTION 'A(z) % sor nem "%" néven szerepel – leállás', r.team_id, r.old_name;
    END IF;
    IF EXISTS (SELECT 1 FROM teams WHERE lower(trim(name)) = lower(r.new_name)) THEN
      RAISE EXCEPTION 'Az új név már foglalt: % – leállás', r.new_name;
    END IF;

    UPDATE teams SET name = r.new_name WHERE id = r.team_id;
    RAISE NOTICE 'Átnevezve: % → %', r.old_name, r.new_name;
  END LOOP;
END $$;

-- Ellenőrzés az Editorban (várt: 3 sor az új nevekkel, változatlan short_name):
SELECT id, name, short_name
FROM teams
WHERE id IN (
  '8ef9f1fe-1b3d-4c2f-84c3-cc2ceae3b457',
  'd96c2f28-d38e-4813-b35f-5ceab8749368',
  'e4401f4a-e4bb-4ff4-b10f-48a8f7200c65'
)
ORDER BY name;
