# Játékosok Adatainak Frissítése

## Lépések

### 1. Nyisd meg a Supabase SQL Editort

Menj a következő linkre:
https://supabase.com/dashboard/project/iipcpjczjjkwwifwzmut/sql/new

### 2. Másold be a FRISSITES.sql tartalmát

Nyisd meg a `FRISSITES.sql` fájlt, és másold be a teljes tartalmát a Supabase SQL Editor-ba.

### 3. Futtasd le az SQL szkriptet

Kattints a "Run" gombra a jobb felső sarokban.

### 4. Ellenőrizd az eredményt

A szkript végén egy SELECT query van, ami megjeleníti az összes játékos frissített adatait:
- Mezszám (number)
- Név (name)
- Születési év (birth_year)
- Poszt (position) - magyar fordítással
- Magasság (height) - cm-ben
- Súly (weight) - kg-ban

### 5. Indítsd újra az alkalmazást

```bash
npm run dev
```

Most már láthatóak lesznek a játékosok részletes adatai az alkalmazásban!

## Frissített Játékosok

| # | Név | Születés | Poszt | Magasság | Súly |
|---|-----|----------|-------|----------|------|
| 0 | Edwin Deon Javern | 1992 | 1-2 (Irányító/Dobóhátvéd) | 194 cm | 100 kg |
| 1 | Nagy Dániel | 2006 | 3-4 (Kiscsatár/Erőcsatár) | 193 cm | 89 kg |
| 2 | Bluiett Trevon Nykee | 1994 | 2-3 (Dobóhátvéd/Kiscsatár) | 198 cm | 98 kg |
| 3 | Hicks Tony Hollis | 1994 | 1 (Irányító) | 189 cm | 84 kg |
| 4 | Edosomwan Kinsley Nehizena | 1993 | 5 (Center) | 206 cm | 118 kg |
| 7 | Eilingsfeld János | 1991 | 4 (Erőcsatár) | 200 cm | 103 kg |
| 10 | Révész Ádám | 1995 | 5 (Center) | 200 cm | 108 kg |
| 11 | Benke Szilárd | 1995 | 2-3 (Dobóhátvéd/Kiscsatár) | 197 cm | 95 kg |
| 12 | Halmai Dániel | 2004 | 1 (Irányító) | 184 cm | 80 kg |
| 13 | Géringer Gergő | 2005 | 3-4 (Kiscsatár/Erőcsatár) | 198 cm | 97 kg |
| 15 | Arnold Botond | 2003 | 5-4 (Center/Erőcsatár) | 206 cm | 105 kg |
| 22 | Krivacevic Markó | 1996 | 5-4 (Center/Erőcsatár) | 202 cm | 98 kg |
| 41 | Cohill Eric Edward | 2003 | 3 (Kiscsatár) | 196 cm | 86 kg |
