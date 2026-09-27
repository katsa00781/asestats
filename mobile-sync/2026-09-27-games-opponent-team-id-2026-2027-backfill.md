# A 2026/2027-es `games` sorok `opponent_team_id` backfillje

- **Dátum:** 2026-09-27
- **Webes commit:** ez a commit
- **Típus:** adattartalom
- **Állapot a mobilban:** NYITOTT

## Mi változott
- A 2026/2027-es szezon mind a 14 `games` sorában `NULL` volt az
  `opponent_team_id`. Ok: a C/2-es importkód (`fa0a719`) nem volt pusholva, a
  GitHub Actions scrape a régi kóddal írta a sorokat.
- A push megtörtént (`03e7ddd..64c732d`), az új fordulók sorai már ID-vel
  jönnek.
- A 14 meglévő sort a meglévő, idempotens
  `migrations/add-games-opponent-team-id.sql` tölti vissza pontos
  névegyezéssel. Próbafuttatás: 14/14 egyértelmű, a párok kölcsönösek.
- Séma nem változott.

## Hatás a mobil appra
- A backfill előtt a mobil post-game nézet (`lib/postgame-data.ts`
  `fetchOpponentLines`) a 2026/27-es meccseken nem találja az ellenfél box
  score-t. Emiatt „Ellenfél” a név, az OREB% 100%, és a védekezés értékelése
  korlátozott. A backfill után ez kódmódosítás nélkül rendbe jön.
- A D-119 szerinti ID-s párosítás (scouting, listák, `pairGames`) az új
  szezonban eddig a névtartalékra esett vissza. A backfill után ID-vel megy.
- A mobil build nem törik.

## Teendő a mobil repóban
- [ ] A backfill után a Pécs–ASE (2026-09-26) post-game harness újrafuttatása:
      ellenfél box score megvan, az OREB% reális.
- [ ] A `docs/feature-tasks.md` nyitott sorának lezárása („az ellenfél box
      score névtartaléka…”). Döntés kell: a D-119 szerinti
      `findOpponentTeam` névtartalék a post-game-ben is legyen-e, védelemként
      a jövőbeli ID nélküli sorokra (pl. kézi JSON import).

## Kézi lépések
- **Még NEM futott:** `migrations/add-games-opponent-team-id.sql`
  újrafuttatása a Supabase SQL Editorban. Várt NOTICE: `14 pontos név, 0
  átnevezés, 0 feloldatlan`. Az ellenőrző lekérdezés 0 sort ad.
