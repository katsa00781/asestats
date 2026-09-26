# games.opponent_team_id – ellenfél azonosítás név helyett ID-vel

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (1/2 – migráció; a webes író/olvasó kód a 2. lépésben jön, külön jegyzettel)
- **Típus:** adatbázis
- **Állapot a mobilban:** ÁTVEZETVE (2026-09-26, mobil commit c83925e)

## Mi változott
- `games` tábla: új `opponent_team_id uuid` oszlop (FK → `teams.id`, `ON DELETE SET NULL`, nullable) + index `(season_id, opponent_team_id)`.
- Visszatöltés a meglévő 1086 meccsre: pontos névegyezés + a régi `Endo Plus Service-Honvéd` név → `Budapesti Honvéd Sportegyesület` sor.
- A `games.opponent` szöveg megmarad (megjelenítési név), de a csapat-azonosítás ezentúl az `opponent_team_id`-n alapul.
- Migráció: `migrations/add-games-opponent-team-id.sql`.

## Hatás a mobil appra
- A mostani mobil build **nem törik**: új, nullable oszlop, a meglévő lekérdezések változatlanul működnek.
- Ha a mobil az ellenfelet `teams.name === games.opponent` egyezéssel keresi (a webes `useGameData` mintájára: ellenfél meccs-párosítás / `opponentGameId`, csapat-összehasonlítás szűrés), akkor ugyanaz a hiba él benne: a 69 régi nevű Honvéd meccsnél nincs találat, és minden jövőbeli klub-átnevezés tovább rontja.

## Teendő a mobil repóban
- [x] Supabase típusok frissítése: `games.opponent_team_id: string | null`.
- [x] Ahol a mobil `games.opponent` szöveget `teams.name`-mel párosít: átállás `opponent_team_id`-re (NULL esetén név fallback).
- [x] Az ellenfél-meccs lekérdezésnél (`.eq('opponent', teamName)`) átállás `.eq('opponent_team_id', teamId)`-re.

## Kézi lépések
- A migrációt a Supabase SQL Editorban kell lefuttatni (a webes 2. lépés előfeltétele). Futtatás után az ellenőrző lekérdezésnek 0 sort kell adnia.
