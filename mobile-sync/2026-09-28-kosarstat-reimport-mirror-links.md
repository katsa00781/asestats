# Kosarstat: 3 meccs újraimportja és tükörsor-linkelés

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** adattartalom | scraping
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-28, mobil commit 3a1eea4; ellenőrizve mind a 6 nézőpontból, kódváltozás nem kellett)

## Mi változott
- Adat: a 2026-09-26-i `20260926114138` (Honvéd–Kecskemét), `20260926127201`
  (Szombathely–Fót) és `20260926136166` (Kaposvár–Szeged) Kosarstat
  meccsek nyers oldalai force reimporttal újra betöltve (a korábbi import a
  CMP-dialógus szövegét mentette csapatnévként). A 2026/27-es `games` sorok
  mind (14/14) `kosarstat_game_id` linket kaptak (korábban 8/14).
- Kód: `scrape-utils.ts` `withMirrorGames()`; a `scrape-kosarstat-playbyplay.ts`
  és a `scripts/backfill-kosarstat-game-links.ts` a névalapú párosítás után a
  meccs tükörsorát (felcserélt `our_team_id` / `opponent_team_id`) is linkeli
  – szponzornév-driftnél eddig csak az egyik csapat sora kapott linket.

## Hatás a mobil appra
- A Kecskemét, Fót, Kaposvár és Szeged szemszögű post-game nézet mostantól
  megkapja a Kosarstat negyed- / csapatmutató- / lineup-adatot. Kódváltozás
  a mobilban nem kell.

## Teendő a mobil repóban
- [x] Ellenőrzés: a fenti meccsek post-game nézete betölti a Kosarstat blokkot

## Kézi lépések
nincs (a reimport és a backfill lefutott, 2026-09-28)
