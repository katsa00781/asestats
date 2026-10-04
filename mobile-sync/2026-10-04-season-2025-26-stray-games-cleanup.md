# 2025/2026 szezon: tévesen bekerült 2024/25-ös meccsek törlése

- **Dátum:** 2026-10-04
- **Webes commit:** ez a commit
- **Típus:** adattartalom
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit 4f94694; kódváltozás nem kellett – élő adaton ASE 39 meccs, legkorábbi 2025-09-27, Halmai 37; perzisztált szezonadat-cache nincs)

## Mi változott
- Feltárt adathiba: 2026-02-07-én és 2026-04-20-án a box-score import a
  2024/2025-ös Hunbasket sluggal (`x2425`) futott, de a 2025/2026 szezonba
  írt. A 2025/2026 szezonban **276 `games` sor** (csapatonként 19–21, dátum
  2024-09-27 – 2025-02-28) és **2737 `player_game_stats_2025_2026` sor**
  tartozik rossz szezonhoz. Ugyanezek a meccsek a 2024/2025 szezonban
  helyesen megvannak.
- Új javító script: `migrations/fix-remove-2024-25-games-from-2025-26-season.sql`
  – törli a 2025/2026 szezon azon meccseit, amelyek dátuma a szezon kezdete
  előtti és van párjuk a 2024/2025 szezonban, a játékos-sorokkal együtt;
  törli továbbá az összesítő-sorból keletkezett „játékost” (név: csupa szám
  és tabulátor, 1 sor a 2026-02-22-i Honvéd–ASE meccsen). A `players` tábla
  többi sorához nem nyúl.
- Sémaváltozás nincs.

## Hatás a mobil appra
- A futtatásig a mobil 2025/2026-os nézetei is a kevert adatot mutatták:
  csapatonként ~20 meccsel több a meccslistában, a
  `player_season_stats_by_season` view-ból jövő játékos-összesítők (meccsszám,
  átlagok) a régi szezon sorait is tartalmazzák (pl. ASE: 58 meccs a valós
  39 helyett; Halmai 56 meccs a valós 37 helyett), a liga-benchmarkok torzak.
- A futtatás után a számok maguktól helyreállnak – a mobil a közös
  adatbázist olvassa, kódváltozás nem kell.
- A 2024/2025 és a 2026/2027 szezon nem érintett.

## Teendő a mobil repóban
- [x] A futtatás után ellenőrizni a mobilban: 2025/2026 szezon, ASE –
      39 meccs, a legkorábbi dátum 2025-09-27
- [x] Ha a mobil gyorsítótáraz szezonadatot (AsyncStorage), a 2025/2026-os
      gyorsítótár ürítése

## Kézi lépések
**Lefuttatva 2026-10-04-én** a Supabase SQL Editorban
(`migrations/fix-remove-2024-25-games-from-2025-26-season.sql`). Ellenőrzött
végállapot: 0 szezonon kívüli meccs a 2025/2026 szezonban, ASE 39 meccs,
`player_game_stats_2025_2026` 7194 → 4456 sor, a view-ban Halmai 37 meccs.

Nyitott, a script nem kezeli: 138 `hunbasket_shotchart_raw` sor
(`season_slug = x2425`) szintén a 2025/2026 szezon alatt áll – erről külön
döntés kell (átírás 2024/2025-re vagy törlés).
