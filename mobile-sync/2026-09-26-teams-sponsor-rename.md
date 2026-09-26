# Három csapat átnevezése a 2026/2027-es nevekre

- **Dátum:** 2026-09-26
- **Webes commit:** ez a commit (az SQL futtatása kézi lépés, lásd lent)
- **Típus:** adattartalom
- **Állapot a mobilban:** NYITOTT

## Mi változott
- `teams.name` (id és `short_name` változatlan):
  - `MVM-OSE Lions` → `OSE Lions` (`8ef9f1fe-…`)
  - `SZTE-Szedeák` → `Délút-SZTE-Szedeák` (`d96c2f28-…`)
  - `Falco-Vulcano Energia KC Szombathely` → `Falco KC Szombathely` (`e4401f4a-…`)
- A `games.opponent` szöveg nem változik (a meccs kori név marad).
- Migráció: `migrations/rename-teams-2026-2027-sponsor-names.sql`.

## Hatás a mobil appra
- Csapatválasztó, igazolások, csapatnézetek: az új nevek jelennek meg – a régi szezonoknál is, mert ezek a `teams.name`-ből olvasnak.
- A régi meccslistákban az ellenfél továbbra is a régi néven látszik (`games.opponent`).
- **Törhet**, ha a mobil az ellenfelet `games.opponent === teams.name` egyezéssel párosítja: az átnevezés után a három klub régi meccseinél nincs találat. Ez a `2026-09-26-games-opponent-team-id*.md` jegyzetek átvezetésével (párosítás `opponent_team_id`-n) megszűnik – azokat ezelőtt vagy ezzel együtt kell átvezetni.
- Ha a mobil csapatnevet hardcode-ol (pl. szűrő, szín, logó térkép), a régi nevet frissíteni kell.

## Teendő a mobil repóban
- [ ] A `games-opponent-team-id` jegyzetek átvezetése (előfeltétel).
- [ ] Keresés a három régi névre a mobil kódban; ha hardcode-olt, cserélni.

## Kézi lépések
- A `migrations/rename-teams-2026-2027-sponsor-names.sql` futtatása a Supabase SQL Editorban (a jegyzet írásakor még NEM futott).
