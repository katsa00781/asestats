# Játékosnevek ékezetes nagybetűinek javítása (players.name)

- **Dátum:** 2026-09-27
- **Webes commit:** ez a commit
- **Típus:** adattartalom | scraping
- **Állapot a mobilban:** ÁTVEZETVE (2026-10-04, mobil commit 4f94694; kódváltozás nem kellett – a 2025/26 és 2026/27 nevek helyesek, a hibás alakra épülő kód nincs, a cache csak memóriában él)

## Mi változott
- A Hunbasket box-score / keret táblája 2026 januárja óta ASCII-only nagybetűsítéssel adja a vezetéknevet („RéVéSZ Ádám”, „BUGLYó Barna Gergő”), és ez így került a `players.name`-be.
- Adatjavítás: `migrations/fix-hunbasket-uppercased-player-names.sql` lefuttatva – **124 `players` sor** (2025/26: 69, 2026/27: 55) → „RÉVÉSZ Ádám”, „BUGLYÓ Barna Gergő”. A `player_id`-k és a `lower(trim(name))` dedup-kulcs nem változtak; más tábla (`league_players`, `hunbasket_shot_events`, `hunbasket_player_links`) nem volt érintett.
- Scraping: `scrape-utils.ts` új `fixAsciiUppercasedName()` + közös `cleanPlayerName()` (a `scrape-hunbasket.ts` és a `scrape-hunbasket-rosters.ts` duplikált példánya helyett) – az új importok már helyes nevet írnak.

## Hatás a mobil appra
- Csak megjelenítés: a 2025/26 és 2026/27 játékosnevek a mobilban is helyesen jelennek meg (újratöltés / cache ürítés után). Séma és id nem változott, a build nem törik.
- Ha a mobil név szerint párosít (pl. szezonok közti játékos-összevetés), és a párosítás kis-/nagybetűre érzékeny, a „RÉVÉSZ Ádám” (25/26+) és „Révész Ádám” (24/25) eltérés továbbra is fennáll – ez nem új, a nagybetűs vezetéknév a Hunbasket formátuma.

## Teendő a mobil repóban
- [x] Ha van helyi cache (AsyncStorage / query cache) a játékosnevekre, érvénytelenítés vagy újratöltés
- [x] Ellenőrizni, hogy nincs-e a mobilban a hibás alakra („RéVéSZ”) épülő kerülőmegoldás

## Kézi lépések
A migráció lefutott (2026-09-27, `scripts/run-sql.sh`; újrafuttatva 124 × `UPDATE 0`, idempotens). A korábban mentett AI szöveges riportok (`game_text_reports` stb.) szövegében a régi alak maradhat – ezek historikus szövegek, nem javítottuk.
