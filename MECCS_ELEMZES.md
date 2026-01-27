# Csapat Meccs Elemzés Funkció

## Áttekintés

Ez a funkció lehetővé teszi a csapat meccsenkénti teljesítményének összehasonlítását a szezonbeli átlagokkal.

## Telepítési Lépések

### 1. Adatbázis View-k Létrehozása

Futtasd le a következő SQL szkriptet a Supabase adatbázisban:

```bash
# A migrations mappában található szkript
/migrations/add-team-game-analysis-views.sql
```

Ez a szkript három view-t hoz létre:
- `team_game_stats` - Csapat statisztikák meccsenkénti bontásban
- `team_season_averages` - Csapat szezonbeli átlagok
- `game_vs_season_comparison` - Meccs vs szezon átlag összehasonlítás

### 2. Komponensek

Két új komponens lett létrehozva:

#### GameDetails.tsx
- Részletes meccs nézet
- Csapat dobás statisztikák összehasonlítása a szezon átlaggal
- Játékosok teljesítményének megjelenítése

#### GamesList.tsx (frissítve)
- Hozzáadva a "Részletek" gomb minden meccshez
- Kattintásra megnyitja a GameDetails komponenst

### 3. Használat

1. **Navigálj a Meccsek listához** a főoldalon
2. **Kattints a "Részletek" gombra** bármelyik meccs kártyáján
3. **Nézd meg az elemzést:**
   - Dobás statisztikák (közeli, középtávoli, 3 pontos, büntető)
   - Összehasonlítás a szezon átlaggal
   - Különbség mutatók (zöld = jobb, piros = rosszabb)
   - Játékosok teljesítménye

## Adatok Magyarázata

### Dobás Statisztikák Táblázat

| Oszlop | Leírás |
|--------|--------|
| **Kísérletek** | Hány dobást kísérelt meg a csapat ebből a típusból |
| **Hatékonyság %** | A meccsben elért találati arány |
| **Átlag %** | A szezonbeli átlagos találati arány |
| **Pontok** | Ebből a dobástípusból szerzett pontok a meccsen |
| **Átlag Pontok** | Szezonbeli átlag pontszám ebből a dobástípusból |
| **Különbség** | Hány ponttal jobb/rosszabb volt a teljesítmény az átlagnál |

### Dobástípusok

- **Közeli**: 2 pontos dobások kosár közelről
- **Középtávoli**: 2 pontos dobások középtávolságról
- **3 pontos**: Hárompontos dobások
- **Büntető**: Büntetődobások (1 pont/db)

### Játékos Statisztikák Rövidítések

- **LP** - Lepattanó (összes)
- **GP** - Gólpassz
- **LS** - Labdaszerzés
- **BD** - Blokkolt dobás
- **LV** - Labdavesztés
- **SZ** - Szabálytalanság
- **±** - Plusz-mínusz (csapat pontjai amikor a játékos pályán volt)
- **ÉRT** - Értékelés (összesített teljesítmény mutató)

## Technikai Részletek

### View-k Működése

1. **team_game_stats**: 
   - Összegzi az összes játékos statisztikáját meccsenkénti bontásban
   - Kiszámítja a dobási százalékokat
   - Pontokat számol dobástípusonként

2. **team_season_averages**:
   - Átlagolja a meccsstatisztikákat szezonra
   - Csapat és szezon szinten aggregál

3. **game_vs_season_comparison**:
   - Összekapcsolja az előző két view-t
   - Kiszámítja a különbségeket

### Teljesítmény

- A view-k indexeket használnak a gyors lekérdezéshez
- Security Invoker módban futnak (RLS policy-k érvényesek)
- Optimalizáltak nagy adatmennyiség kezelésére

## Hibaelhárítás

### "Nem található meccs adat"
- Ellenőrizd, hogy a view-k sikeresen létrejöttek-e
- Nézd meg, hogy a meccshez vannak-e player_game_stats rekordok

### Lassú betöltés
- Ellenőrizd az indexeket:
  ```sql
  SELECT * FROM pg_indexes WHERE tablename IN ('games', 'player_game_stats', 'players');
  ```

### Hibás átlagok
- Futtasd újra a view létrehozó szkriptet
- Ellenőrizd, hogy a season_id és our_team_id mezők helyesen vannak-e beállítva

## Jövőbeli Fejlesztések

- [ ] Grafikonok hozzáadása a trendek vizualizálásához
- [ ] Több meccses összehasonlítás
- [ ] Export funkcionalitás (PDF, Excel)
- [ ] Push értesítések játék után az elemzésekről
- [ ] Ellenfél statisztikák hozzáadása
