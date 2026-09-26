# games.opponent_team_id – az importok kitöltik

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (C/2 – írók; előzmény: `2026-09-26-games-opponent-team-id.md`)
- **Típus:** scraping
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `scrape-hunbasket.ts` (box-score import, hétvégi `scrape.yml`), `components/GameQuickImport.tsx`, `components/JsonImport.tsx`: minden új vagy frissített `games` sorba bekerül az `opponent_team_id`.
- A migráció óta mind az 1086 meccs ki van töltve; mostantól az új meccsek is. `NULL` csak a JSON importnál fordulhat elő, ha az ellenfél csapat nincs kiválasztva.
- `lib/supabase.ts` `games` típus: `opponent_team_id` a Row/Insert típusban.

## Hatás a mobil appra
- Nem törik semmi. A mobil ezentúl bízhat abban, hogy a scrapelt meccseknél az `opponent_team_id` ki van töltve.

## Teendő a mobil repóban
- [ ] Az előző jegyzet (`2026-09-26-games-opponent-team-id.md`) teendőivel együtt vezetendő át; önálló lépés nem kell.

## Kézi lépések
nincs (a migráció már lefutott, ellenőrizve: 0 NULL sor)
