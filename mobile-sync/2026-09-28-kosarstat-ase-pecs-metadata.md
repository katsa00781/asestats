# Kosarstat: az ASE–Pécs meccs nyers metaadatának javítása

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** adattartalom
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4; post-game és clutch ellenőrizve, kódváltozás nem kellett)

## Mi változott
- A `20260926102180` (ASE–Pécs, 2026-09-26) Kosarstat meccs nyers oldalai
  force reimporttal újra betöltve. A `kosarstat_game_pages_raw.home_team_name`
  / `away_team_name` eddig a CMP-dialógus szövege volt („KosarStat.hu” / „Do
  Not Process My Personal Information”), most „Atomerőmű SE” / „NKA
  Universitas Pécs”. A 2026/27-es szezonban nem maradt CMP-szöveges oldal.
- A `games` linkek nem változtak (2 sor, mindkettő `20260926102180`); a
  kinyert táblák, negyedek és csapatmutatók tartalma azonos.

## Hatás a mobil appra
- Ha a mobil a nyers metaadat csapatneveit használja (pl. a clutch-oldal
  csapatoldalának feloldásához), az ASE–Pécs meccsnél most helyes nevet kap.
  Kódváltozás nem kell.

## Teendő a mobil repóban
- [x] Ellenőrzés: az ASE–Pécs post-game / clutch nézet betölt

## Kézi lépések
nincs (a reimport lefutott, 2026-09-28)
