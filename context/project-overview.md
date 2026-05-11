# ASEStats – Projekt Áttekintés

## Overview

Az ASEStats egy magyar kosárlabda statisztikai és elemzési platform, amelyet az ASE (Atomerőmű SE) kosárlabdacsapat belső használatára fejlesztünk. Az alkalmazás automatikusan gyűjti a mérkőzés-adatokat a Hunbasket.hu és Kosarstat.hu nyilvános forrásokból, tárolja azokat Supabase (PostgreSQL) adatbázisban, és egy Next.js alapú dashboardon jeleníti meg. A rendszer mérkőzések előtti scouting riportokat és meccs utáni statisztikai elemzéseket is generál, segítve az edzői stábnak a döntéshozatalt.

## Goals

1. Automatizálni a mérkőzési adatok gyűjtését Hunbasket.hu-ról és Kosarstat.hu-ról Playwright alapú scraping-gel
2. Centralizált statisztikai adatbázist fenntartani minden szezonra és csapatra vonatkozóan
3. Játékos- és csapatszintű statisztikákat megjeleníteni valós idejű szűréssel (szezon, csapat)
4. Mérkőzések előtti (pregame scouting) és utáni (postgame) szöveges elemzési riportokat generálni
5. Bejelentkezés-védett, csak belső felhasználóknak elérhető webes dashboard-ot biztosítani

## Core User Flow

1. Felhasználó megnyitja az alkalmazást → a Supabase auth alapján bejelentkezési képernyő jelenik meg
2. Bejelentkezés után a főoldal betöltődik a szezon- és csapatválasztóval
3. A felhasználó kiválaszt egy szezont és egy csapatot → az adatok betöltődnek Supabase-ből
4. A dashboard tab-ok között navigál: Áttekintés, Játékosok, Elemzések, Tabella, Meccsek, Meccs Log, Szituációk
5. Importáláshoz a felhasználó a Kosarstat PBP / Fixtures / Roster / Round / JSON Import tab-ok egyikét használja
6. Az admin a Kezelés, Játékos Import, Törlés tab-okon kezeli az adatokat
7. Az adatok frissítéséhez CLI szkriptek futtathatók: `npm run hunbasket:*` és `npm run kosarstat:pbp`

## Features

### Statisztika Megjelenítés

- Csapatszintű statisztikák (TeamStatistics) és átlagok meccsenként
- Játékosok listája aggregált szezon-statisztikákkal (PlayersList)
- Játékos részletes nézet: meccsenkénti teljesítmény, trendek, fejlett metrikák (PlayerDetails)
- Fejlett statisztikák: True Shooting %, Effective FG%, Offensive/Defensive Rating, Valuation
- Meccsek listája az eredményekkel és közelgő mérkőzések naptárával (GamesList)
- Meccs Log: összes mérkőzés részletes lebontása (GameLog)
- Szituációs elemzés: hazai/vendég, nyert/veszített mérkőzések bontása (SituationalAnalysis)

### Elemzés és Összehasonlítás

- Játékos összehasonlítás több szezonon és csapaton átívelően (PlayerComparison)
- Csapat összehasonlítás (TeamComparison)
- Szezon összehasonlítás (SeasonComparison)
- Pregame scouting riportok (`lib/pregame-scouting.ts`)
- Postgame elemzési riportok (`lib/postgame-report.ts`)
- Shot scatter chart és zone heatmap vizualizáció

### Adatimport

- Kosarstat PBP (play-by-play) import API-n keresztül (KosarstatPbpImport)
- Fixtures import (FixturesImport)
- Roster import (RosterImport)
- Round import (RoundImport)
- JSON import kézi beillesztéssel (JsonImport)
- Gyors meccs import (GameQuickImport)
- CLI szkriptekkel: Hunbasket.hu teljes szezon, shot chart, play-by-play

### Tabella és Csapat Kezelés

- Tabella megjelenítés (StandingsView) és import (StandingsImport)
- Játékos kezelés (PlayersManagement), hozzáadás/szerkesztés/törlés
- Meccs kezelés törlési funkciókkal (GameManagement)
- Szezon és csapat szűrők (SeasonSelector, TeamSelector)

### Auth

- Supabase alapú email/jelszó hitelesítés
- AuthProvider context az egész alkalmazást lefedi
- Bejelentkezetlen állapotban csak a LoginForm látható

## Scope

### In Scope

- Next.js webes dashboard bejelentkezés-védelemmel
- Supabase (PostgreSQL) adattárolás és lekérdezés
- Hunbasket.hu és Kosarstat.hu scraping Playwright-tal
- Játékos és csapat statisztikák megjelenítése és elemzése
- Pregame és postgame szöveges riportok generálása
- Szezon- és csapatalapú szűrés
- Adatimport API route-okon és CLI szkripteken keresztül
- SQL migrációk Supabase-hez

### Out of Scope

- Mobilalkalmazás (iOS / Android)
- Valós idejű élő meccs-frissítés (live score)
- Nyilvános, regisztráció nélkül elérhető nézetek
- Több csapat egymástól független admin-felülete (multi-tenant SaaS)
- Fizetési integráció
- Push értesítések
- Más sportágak támogatása

## Success Criteria

1. Bejelentkezett felhasználó kiválaszthat szezont és csapatot, és a megfelelő statisztikák megjelennek
2. Hunbasket scraper sikeresen importál meccsadatokat és játékos statisztikákat egy teljes szezonra
3. Kosarstat PBP import helyes play-by-play adatokat tölt be az adatbázisba
4. Játékos részletes nézetben látható a meccsenkénti teljesítményhistória és trendek
5. A pregame scouting riport generálható egy adott mérkőzés ellenfeléhez
6. `npm run build` hibák nélkül lefut
7. Nincs TypeScript hiba strict mode-ban
