# Post-game riport: adatvalidáció – dobástérkép vs. box score, névillesztés, meccsbeli pozíció

- **Dátum:** 2026-09-28
- **Webes commit:** ez a commit
- **Típus:** @core | funkcionális
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `lib/postgame-report.ts` (`@core`): `analyzePostGameReport` összeveti a
  dobástérkép dobásszámát a box score FGA-jával. Legalább 3 dobás vagy 5%
  eltérésnél `dataNotes` megjegyzés jön (pl. „Dobástérkép hiányos: 73 dobás a
  box score 76 mezőnykísérletével szemben (-3); … 3P% 31.8% … box score 3P%
  38.5%”); 3P-besorolási eltérésnél (≥ 3 kísérlet) külön megjegyzés. 10%
  feletti hiánynál a `shotMap.comparison` `null`, és a dobástérkép-alapú
  erősség/probléma sorok kimaradnak.
- Új `lib/player-name-match.ts` (még **nem** `@core`, tiszta függvények):
  vezetéknév-alapú box score ↔ Kosarstat névillesztés
  (`playerNamesMatch`, `resolvePlayerNames`, `PLAYER_NAME_ALIASES`). A
  korábbi webes illesztő a 6+ betűs közös keresztnév miatt két csapattársat
  („HALMAI Dániel” / „NAGY Dániel”) is összepárosított.
- Webes (`SeasonComparison.tsx`): a nem párosítható Kosarstat nevek, a
  < 1 perces (box score-ból hiányzó) játékosok és a kétértelmű nevek a
  riport `dataNotes`-ába kerülnek. A játékos pozíciója a post-game-ben a
  meccsbeli Kosarstat lineup-slot (legtöbb idő), fallback a keretpozíció
  (felhasználói döntés). `lib/export-to-md.ts`: új „Adatminőség és
  megjegyzések” szekció.

## Hatás a mobil appra
- A build nem törik.
- A mobil post-game riportjában megjelenhetnek az új dobástérkép-
  megjegyzések; hiányos dobástérképnél kevesebb dobástérkép-sor lesz az
  erősségek/problémák közt.
- Ha a mobil saját névillesztést vagy pozíció-leképezést használ a Kosarstat
  lineuphoz, ott ugyanaz a „közös keresztnév” hiba állhat fenn.

## Teendő a mobil repóban
- [ ] `npm run sync:core`
- [ ] Ha a mobil a `dataNotes`-ot nem mutatja, érdemes megjeleníteni
      (adatminőség)
- [ ] Ha a mobil Kosarstat ↔ box score neveket párosít: döntés, hogy a
      `lib/player-name-match.ts` bekerüljön-e a `@core` tükrözött modulok
      közé (webes CLAUDE.md lista bővítése)

## Kézi lépések
nincs
