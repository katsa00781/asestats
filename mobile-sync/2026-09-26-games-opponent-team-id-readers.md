# Ellenfél-párosítás opponent_team_id alapján (webes olvasók)

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (C/3 – olvasók; előzmények: `2026-09-26-games-opponent-team-id.md`, `2026-09-26-games-opponent-team-id-writers.md`)
- **Típus:** funkcionális
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `hooks/useGameData.ts`: az ellenfél csapat-azonosítója `games.opponent_team_id` (név csak fallback ID nélküli sorra); az ellenfél saját meccssorának lekérdezése `.eq('opponent', teamName)` helyett `.eq('opponent_team_id', selectedTeamId)`. Így áll elő a `TeamGame.opponentGameId`.
- `components/TeamComparison.tsx`: az egymás elleni (head-to-head) meccsek szűrése `opponent_team_id === teamB.teamId` (név fallback).
- `components/JsonImport.tsx`: meglévő meccs kiválasztásakor az ellenfél csapat az ID-ből töltődik.
- Invariáns: `context/architecture.md` 11. pont.

## Hatás a mobil appra
- Mérhető javulás a webben (minden csapat, szezon): párosított ellenfél-meccs 2024/25: 314 → 366 / 366; 2025/26: 634 → 720 / 721. A hiányzók főleg a régi nevű Honvéd meccsek voltak (mindkét irányból).
- Ha a mobil ugyanígy név szerint párosít, ott ugyanezek a meccsek most is ellenfél-oldal nélkül jelennek meg (meccsrészletek, egymás elleni mérleg).

## Teendő a mobil repóban
- [ ] Az ellenfél-meccs párosítás és az egymás elleni szűrés átállítása `opponent_team_id`-re, a webes mintával azonos név-fallbackkel.
- [ ] Együtt vezetendő át a két előző `games-opponent-team-id` jegyzettel.

## Kézi lépések
nincs
