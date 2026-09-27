# ASE visszaállítva alapcsapatnak (teams.is_primary)

- **Dátum:** 2026-09-27
- **Webes commit:** ez a commit
- **Típus:** adattartalom
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `teams.is_primary = true` az `Atomerőmű SE` sorra (`ff4710a9-e2b2-49fc-904f-37f8356ed5f8`). Előtte egyetlen `is_primary = true` sor sem volt (az ASE sor 2026-01-29-én `false`-szal jött létre).
- Migráció: `migrations/fix-set-ase-primary-team.sql` (idempotens, id-alapú; más sort nem érintett – `UPDATE 0` + `UPDATE 1`).

## Hatás a mobil appra
- Ha a mobil az alapcsapatot `is_primary` alapján választja (vagy `order('is_primary', { ascending: false })` első elemét veszi), eddig nem az ASE-t kapta, mostantól igen.
- Séma nem változott, build nem törik.

## Teendő a mobil repóban
- [ ] Ellenőrizni, hogy a mobil csapatszűrő alapértéke `is_primary`-ből jön-e; ha volt ASE-re égetett kerülőmegoldás (név / id), az kivezethető.

## Kézi lépések
A migráció lefutott (2026-09-27, `scripts/run-sql.sh`), további lépés nincs.
