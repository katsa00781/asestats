# Versenyszakasz-besorolás: tükörmeccs linkje és fordulószám

- **Dátum:** 2026-10-04
- **Webes commit:** ez a commit
- **Típus:** funkcionális
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit 4f94694; döntéssel zárva: a mobil most nem jelöl versenyszakaszt, a `classifyPhase` marad a webes `lib/team-season-export.ts`-ben, mobil D-128)

## Mi változott
A `mobile-sync/2026-10-04-team-game-phase-opponent-fields.md` jegyzetben leírt
`TeamGame.competitionPhase` kitöltése és besorolása pontosodott (a típus nem
változott, `@core` modul nem érintett):

- `hooks/useGameData.ts`: a Kosarstat-link (`games.kosarstat_game_id`) sokszor
  csak a meccs egyik nézetén van meg. A szakasz-címke forrása ezért a saját
  link, annak hiányában a **tükörmeccs** (ellenfél-nézetű `games` sor, azonos
  dátum, felcserélt csapatok) linkje. Az ellenfél-meccsek lekérdezése a
  `kosarstat_game_id` oszlopot is kéri.
- `lib/team-season-export.ts` `classifyPhase(competitionPhase, round, context)`
  (webes, nem `@core`):
  1. van címke → „alapszakasz” = alapszakasz; „döntő / helyért / rájátszás”
     = rájátszás; egyéb = egyéb;
  2. nincs címke, nincs forduló → „Kupa / nem azonosított”;
  3. nincs címke, van forduló → alapszakasz, **kivéve** ha a meccs dátuma az
     utolsó címkézett alapszakasz-meccs utáni ÉS a forduló nem nagyobb az
     addigi legnagyobb alapszakasz-fordulónál → rájátszás. (A helyosztók
     „5. helyért” szövegéből a scraper `round = 5`-öt ír.)
- Új webes export-szakaszok (negyedprofil, ötösök / on-off, liga-összehasonlítás)
  – csak a webes MD exportot érintik.
- Adatbázis-, scraping- és API-változás nincs.

## Hatás a mobil appra
- A mostani mobil build nem törik, a mobil jelenleg nem jelöl versenyszakaszt.
- Ha a mobil meccslistája szakaszt jelöl majd, a fenti szabályt kell követnie,
  különben a link nélküli helyosztók alapszakasznak látszanak (2025/2026-ban
  ligaszinten 8 ilyen meccs volt).

## Teendő a mobil repóban
- [ ] A versenyszakasz-jelölés bevezetésekor a tükörmeccs linkjét is
      figyelembe venni és a `classifyPhase` 3 lépéses szabályát átvenni
- [x] Eldönteni, hogy a `classifyPhase` átkerüljön-e egy `@core` modulba
      (jelenleg a webes `lib/team-season-export.ts`-ben él) → nem aktuális, amíg a
      mobil nem jelöl versenyszakaszt; ha újranyílik, `@core` modul legyen
      (mobil D-128)

## Kézi lépések
nincs
