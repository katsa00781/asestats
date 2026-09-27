-- ASE (Atomerőmű SE) visszaállítása alapcsapatnak (is_primary = true)
--
-- Háttér (2026-09-27): a teams táblában egyetlen is_primary = true sor sem
-- volt – az „Atomerőmű SE” sor 2026-01-29-én is_primary = false értékkel jött
-- létre. Emiatt a TeamSelector / JsonImport / GameQuickImport / GameManagement
-- alapcsapata ábécérendben az „Alba Fehérvár” lett.
--
-- Id-alapú, idempotens; egyszerre legfeljebb egy alapcsapat marad.
-- Futtatás: Supabase SQL Editor vagy ./scripts/run-sql.sh migrations/fix-set-ase-primary-team.sql

BEGIN;

UPDATE teams
SET is_primary = false
WHERE is_primary = true
  AND id <> 'ff4710a9-e2b2-49fc-904f-37f8356ed5f8';

UPDATE teams
SET is_primary = true
WHERE id = 'ff4710a9-e2b2-49fc-904f-37f8356ed5f8'
  AND name = 'Atomerőmű SE';

-- Ellenőrzés: pontosan egy sor, az Atomerőmű SE
SELECT id, name, short_name, is_primary
FROM teams
WHERE is_primary = true;

COMMIT;
