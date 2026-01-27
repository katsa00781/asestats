# Tabella Import Használati Útmutató

## Adatbázis Setup

1. Nyisd meg a Supabase projekt SQL Editort
2. Futtasd le a `supabase-standings-table.sql` fájl tartalmát
3. Ez létrehozza a `standings` táblát az alábbi struktúrával:
   - `id`: UUID (elsődleges kulcs)
   - `matchday`: INTEGER (forduló száma, egyedi)
   - `date`: DATE (forduló dátuma)
   - `data`: JSONB (tabella adatok)
   - `created_at`, `updated_at`: időbélyegek

## Használat

### 1. Tabella Importálás

1. Menj a **Tabella** fülre
2. Görgets le a "Tabella Importálás" kártyáig
3. Add meg a **fordulószámot** (pl. 8)
4. Add meg a **dátumot** (alapértelmezetten a mai nap)
5. Másold ki a teljes tabellát a hivatalos forrásból:
   ```
   H.	Csapat / Férfi NB I. A csoport	M	%	PT	GY	V	DOB	KAP	SOR	HA	VE	UT.5
   1.	 NHSZ-Szolnoki Olajbányász	8	1.00	16	8	0	717	602	GY8	4-0	4-0	5-0
   2.	 Falco-Vulcano Energia KC Szombathely	8	0.94	15	7	1	725	628	GY3	4-0	3-1	4-1
   ...
   ```
6. Illeszd be a szövegmezőbe
7. Kattints az **Importálás** gombra
8. Az előnézet automatikusan megjelenik a feldolgozott adatokkal

### 2. Tabella Megtekintése

- A **Tabella** fül tetején látható a legfrissebb forduló állása
- A legördülő menüből választhatsz korábbi fordulókat
- A tabella színkódolva van:
  - **Zöld** (1-8. hely): Playoff résztvevők
  - **Sárga** (9-10. hely): Középmezőny
  - **Szürke** (11-14. hely): Alsóház

### 3. Mezők Magyarázata

- **H.**: Helyezés
- **M**: Lejátszott meccsek
- **%**: Győzelmi százalék
- **PT**: Pontszám (győzelem = 2 pont, vereség = 1 pont)
- **GY**: Győzelmek
- **V**: Vereségek
- **DOB**: Dobott pontok
- **KAP**: Kapott pontok
- **+/-**: Pontok különbözete
- **SOR**: Aktuális szériya (GY=győzelmi, V=vereségi)
- **HA**: Hazai mérleg
- **VE**: Vendég mérleg
- **UT.5**: Utolsó 5 meccs mérlege

## Adatfrissítés

Ha ugyanazt a fordulót importálod újra (pl. javítás esetén):
- A rendszer automatikusan **felülírja** a meglévő adatokat
- Nem készül duplikált bejegyzés
- Az `updated_at` mező frissül

## Tippek

1. **Formátum**: A másolás során ügyelj arra, hogy tabulátorral elválasztott legyen az adat
2. **Fejléc**: A fejlécsor is beilleszthető, automatikusan kiszűrésre kerül
3. **Emoji-k**: A csapatnevek elején lévő emoji-k automatikusan eltávolításra kerülnek
4. **Előnézet**: Mindig ellenőrizd az előnézetet importálás előtt

## Hibaelhárítás

**"Nem sikerült feldolgozni az adatokat"**
- Ellenőrizd, hogy megfelelő a formátum (tabulátorral elválasztott oszlopok)
- Győződj meg róla, hogy minden sor tartalmaz helyezést (szám az elején)

**"Add meg a fordulószámot"**
- A forduló mező kötelező
- Csak számot adj meg (pl. 8, 9, 10)

## Példa Adat

```
H.	Csapat / Férfi NB I. A csoport	M	%	PT	GY	V	DOB	KAP	SOR	HA	VE	UT.5
1.	 NHSZ-Szolnoki Olajbányász	8	1.00	16	8	0	717	602	GY8	4-0	4-0	5-0
2.	 Falco-Vulcano Energia KC Szombathely	8	0.94	15	7	1	725	628	GY3	4-0	3-1	4-1
```
