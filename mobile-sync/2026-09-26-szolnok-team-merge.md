# Duplikált Szolnok csapatsor összevonása

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (az SQL futtatása kézi lépés, lásd lent)
- **Típus:** adattartalom
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-26, mobil commit 76f752f)

## Mi változott
- A `teams` táblából eltűnik a `Szolnoki Olajbányász` sor (`f9b17624-…`); minden hivatkozása az `NHSZ-Szolnoki Olajbányász` sorra (`62d8fe26-…`) kerül: 10 saját meccs (a 25/26 playoff, 2026. ápr–máj.), 11 ellenfél-hivatkozás, 183 stat sor, 672 dobás, 11 dobástérkép-rekord, 1 pregame riport.
- A 13 duplikált játékossor törlődik; statjaik az azonos nevű NHSZ játékosokhoz kerülnek (a playoff statok így az NHSZ keret szezonösszesítőjébe számítanak).
- Törlődik a 2026-09-26-i incidens duplikált meccssora (2025-09-27 Szolnok–Kaposvár, a DUP alatt).
- Migráció: `migrations/fix-merge-duplicate-szolnok-team.sql`; alias: `scrape-utils.ts` `szolnoki olajbanyasz → nhsz-szolnoki olajbanyasz`.

## Hatás a mobil appra
- A csapatválasztóból eltűnik a „Szolnoki Olajbányász” (a playoff meccsei az NHSZ alatt látszanak).
- Ha a mobil gyorsítótárban / beállításban a DUP csapat `id`-ját tárolja, az már nem létezik → alapcsapatra kell visszaesnie.
- Kódváltozás nem szükséges; a build nem törik.

## Teendő a mobil repóban
- [x] Ellenőrizni, hogy tárolt (AsyncStorage) csapat-id nem mutat-e a törölt `f9b17624-ce30-4195-be7d-e86f073d9722`-re; ha igen, az érvénytelen id-t kezelje (alapcsapat).

## Kézi lépések
- A `migrations/fix-merge-duplicate-szolnok-team.sql` **lefuttatva 2026-09-26-án** a Supabase SQL Editorban, ellenőrizve (0 maradék hivatkozás, NHSZ alatt 82 meccs). Mentés: `archive/backups/2026-09-26-szolnok-team-merge.json` (lokális).
