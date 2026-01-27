# TEAMS SUPPORT - ÖSSZEFOGLALÓ

## 1. Migrációk (KÉSZ ✅)

Futtasd le sorrendben:
1. `add-teams-support.sql` - Teams tábla + ASE
2. `add-teams-to-players.sql` - Players.team_id
3. `add-teams-to-games.sql` - Games.our_team_id
4. `update-views-with-teams.sql` - View-k frissítése

## 2. UI Komponensek (KÉSZ ✅)

- `TeamSelector.tsx` - Csapat választó dropdown
- `app/page.tsx` - Integráció: selectedTeamId state + TeamSelector komponens

## 3. Import logika (FOLYAMATBAN 🔄)

### Szükséges módosítások:

#### A. JsonImport.tsx
```typescript
// Adj hozzá:
const [selectedTeamId, setSelectedTeamId] = useState<string>('');

// Töltsd be a teams-t:
useEffect(() => {
  loadTeams(); // Hasonló mint loadSeasons
}, []);

// Játékos keresés:
.eq('season_id', selectedSeasonId)
.eq('team_id', selectedTeamId)  // ÚJ

// Játékos beszúrás:
season_id: selectedSeasonId,
team_id: selectedTeamId  // ÚJ

// Meccs beszúrás:
season_id: selectedSeasonId,
our_team_id: selectedTeamId  // ÚJ

// UI-ban add hozzá TeamSelector-t a SeasonSelector mellé
```

#### B. GameInput.tsx
```typescript
// Hasonló változtatások mint JsonImport-nál
selectedTeamId prop + team_id szűrés/beszúrás
```

#### C. PlayersManagement.tsx
```typescript
// Játékosok listázása:
.eq('team_id', selectedTeamId)

// Új játékos:
team_id: selectedTeamId
```

## 4. Következő lépések

1. **Futtasd le a migrációkat** Supabase-ben
2. **Teszteld az ASE-vel** (már működnie kell)
3. **Adj hozzá új csapatokat**:
   ```sql
   INSERT INTO teams (name, short_name) 
   VALUES 
     ('Alba Fehérvár', 'ALBA'),
     ('Szolnoki Olaj', 'SZOLNOK'),
     ('Falco KC Szombathely', 'FALCO');
   ```
4. **Frissítsd az import komponenseket** (JsonImport, GameInput, PlayersManagement)

Szeretnéd, hogy folytatom az import komponensek frissítésével?
