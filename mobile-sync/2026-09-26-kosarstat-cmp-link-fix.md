# Kosarstat link javítás – a 2026-09-25-i meccsek újraimportja

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit
- **Típus:** adattartalom + scraping
- **Állapot a mobilban:** NYITOTT

## Mi változott
- A Kosarstat oldalain CMP adatvédelmi dialógus és en dash fejléc jelent meg,
  ezért a `scrape-kosarstat-playbyplay.ts` hibás csapatneveket olvasott
  (`KosarStat.hu` vs `Do Not Process My Personal Information`). A parser javítva.
- Újraimport után a 2026-09-25-i 3 meccs (`20260925101140`, `20260925163119`,
  `20260925169155`) adatai:
  - `games.kosarstat_game_id`: mind a 6 érintett sor (Alba–Körmend,
    Sopron–DEAC, Szolnok–OSE, mindkét oldal) most kapott linket (eddig `NULL`).
  - `kosarstat_game_quarter_stats` / `kosarstat_game_team_metrics`:
    `team_side` `unknown` → `home`/`away`.
  - `kosarstat_game_pages_raw`: helyes `home_team_name`/`away_team_name`/pontszám.
- Séma, `@core` modul nem változott.

## Hatás a mobil appra
- A build nem törik, kódváltozás nem kell.
- A `useGameDetails` / `useGameData` a `kosarstat_game_id` alapján mostantól
  látja a három meccs Kosarstat-adatait (negyedek, clutch, csapatmetrikák).

## Teendő a mobil repóban
- [ ] Ellenőrizni, hogy a 2026-09-25-i meccsek részletező nézetében megjelenik a
  Kosarstat-blokk (pl. ASE-meccs esetén a következő fordulótól); egyéb teendő nincs.

## Kézi lépések
- Az újraimport lefutott 2026-09-26-án
  (`KOSARSTAT_FORCE_REIMPORT=true … --games 20260925163119,20260925169155,20260925101140`).
  Egyéb kézi lépés nincs.
