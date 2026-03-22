import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Upload, FileJson, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type JsonImportProps = {
  onImportComplete?: () => void;
  selectedSeasonId?: string | null;
  lastImportedGame?: {
    date: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    round: number | null;
  } | null;
};

type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type ExistingGameSummary = {
  id: string;
  date: string;
  round: number | null;
  home_away: 'home' | 'away';
  our_team_id: string;
  our_score: number;
  opp_score: number;
  opponent: string;
};

type ParsedPlayerData = {
  number: number;
  name: string;
  minutes: number;
  points: number;
  closeMade: number;
  closeAttempted: number;
  midMade: number;
  midAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  defensiveRebounds: number;
  offensiveRebounds: number;
  totalRebounds: number;
  steals: number;
  turnovers: number;
  foulsDrawn: number; // Fault SA - szerzett/kapott faultok
  fouls: number; // Fault KI - kiosztott faultok
  assists: number;
  blocksSuffered: number; // Blokk SA - kapott blokkok
  blocksGiven: number; // Blokk KA - kiosztott blokkok
  valuation: number;
  offensiveRating: number;
  defensiveRating: number;
  trueShootingPct: number;
  effectiveFGPct: number;
  plusMinus: number;
};

export function JsonImport({ onImportComplete, lastImportedGame, selectedSeasonId: preferredSeasonId }: JsonImportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [useExistingGame, setUseExistingGame] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [existingGames, setExistingGames] = useState<ExistingGameSummary[]>([]);
  const [gameDate, setGameDate] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [round, setRound] = useState('');
  const [rawData, setRawData] = useState('');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [teams, setTeams] = useState<{id: string; name: string; is_primary?: boolean}[]>([]);
  
  // Melyik csapat adatait importáljuk most
  const [currentImportTeam, setCurrentImportTeam] = useState<'home' | 'away'>('home');
  
  // Preview funkció
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedPlayerData[]>([]);

  const normalizePlayerNameForMatch = (value?: string | null) =>
    value
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim() ?? '';

  // Szezonok és csapatok betöltése
  useEffect(() => {
    async function fetchData() {
      try {
        // Szezonok
        const { data: seasonsData, error: seasonsError } = await supabase
          .from('seasons')
          .select('*')
          .order('start_date', { ascending: false });

        if (seasonsError) throw seasonsError;

        if (seasonsData && seasonsData.length > 0) {
          setSeasons(seasonsData);
          const preferredSeason = preferredSeasonId
            ? seasonsData.find((s: Season) => s.id === preferredSeasonId)
            : undefined;
          const currentSeason = seasonsData.find((s: Season) => s.is_current);
          if (preferredSeason) {
            setSelectedSeasonId(preferredSeason.id);
          } else if (currentSeason) {
            setSelectedSeasonId(currentSeason.id);
          } else {
            setSelectedSeasonId(seasonsData[0].id);
          }
        }

        // Csapatok betöltése a teams táblából
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name, short_name, is_primary')
          .order('is_primary', { ascending: false })
          .order('name');

        if (!teamsError && teamsData) {
          setTeams(teamsData);
          const primaryTeam = teamsData.find(t => t.is_primary);
          if (primaryTeam) setHomeTeamId(primaryTeam.id);
        }
      } catch (error) {
        console.error('Hiba az adatok betöltésekor:', error);
      }
    }
    fetchData();
  }, [preferredSeasonId]);

  useEffect(() => {
    if (!preferredSeasonId || seasons.length === 0) return;
    const seasonExists = seasons.some(season => season.id === preferredSeasonId);
    if (seasonExists && preferredSeasonId !== selectedSeasonId) {
      setSelectedSeasonId(preferredSeasonId);
    }
  }, [preferredSeasonId, seasons, selectedSeasonId]);

  const loadExistingGames = useCallback(async () => {
    if (!selectedSeasonId) return;
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*, home_team:our_team_id(name), away_team:opponent')
        .eq('season_id', selectedSeasonId)
        .order('date', { ascending: false });

      if (error) throw error;
      const formattedGames: ExistingGameSummary[] = (data || []).map((game: ExistingGameSummary) => ({
        id: game.id,
        date: game.date,
        round: game.round ?? null,
        home_away: game.home_away,
        our_team_id: game.our_team_id,
        our_score: game.our_score,
        opp_score: game.opp_score,
        opponent: game.opponent,
      }));

      setExistingGames(formattedGames);
    } catch (error) {
      console.error('Hiba a meccsek betöltésekor:', error);
    }
  }, [selectedSeasonId]);

  // Létező meccsek betöltése amikor a szezon változik
  useEffect(() => {
    if (selectedSeasonId && useExistingGame) {
      loadExistingGames();
    }
  }, [selectedSeasonId, useExistingGame, loadExistingGames]);

  // Kiválasztott meccs betöltése
  // lastImportedGame automatikus betöltése új meccs létrehozásakor
  useEffect(() => {
    if (lastImportedGame && !useExistingGame) {
      setGameDate(lastImportedGame.date);
      setHomeScore(lastImportedGame.homeScore.toString());
      setAwayScore(lastImportedGame.awayScore.toString());
      setRound(lastImportedGame.round?.toString() || '');
      
      // Csapatok automatikus azonosítása név alapján
      const homeTeam = teams.find(t => t.name === lastImportedGame.homeTeamName);
      const awayTeam = teams.find(t => t.name === lastImportedGame.awayTeamName);
      if (homeTeam) setHomeTeamId(homeTeam.id);
      if (awayTeam) setAwayTeamId(awayTeam.id);
    }
  }, [lastImportedGame, teams, useExistingGame]);

  const handleSelectExistingGame = (gameId: string) => {
    setSelectedGameId(gameId);
    const game = existingGames.find(g => g.id === gameId);
    if (game) {
      setGameDate(game.date);
      // Meghatározzuk a csapatokat
      if (game.home_away === 'home') {
        setHomeTeamId(game.our_team_id);
        setHomeScore(game.our_score.toString());
        setAwayScore(game.opp_score.toString());
        // Vendég csapatot név alapján keressük
        const awayTeam = teams.find(t => t.name === game.opponent);
        if (awayTeam) setAwayTeamId(awayTeam.id);
      } else {
        setAwayTeamId(game.our_team_id);
        setAwayScore(game.our_score.toString());
        setHomeScore(game.opp_score.toString());
        // Hazai csapatot név alapján keressük
        const homeTeam = teams.find(t => t.name === game.opponent);
        if (homeTeam) setHomeTeamId(homeTeam.id);
      }
    }
  };

  // Preview frissítése amikor a rawData változik
  useEffect(() => {
    if (rawData && showPreview) {
      try {
        const parsed = parseTableData(rawData);
        setPreviewData(parsed);
      } catch (error) {
        console.error('Hiba a preview generálásakor:', error);
        setPreviewData([]);
      }
    } else {
      setPreviewData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, showPreview]);

  const parseTableData = (data: string): ParsedPlayerData[] => {
    const lines = data.trim().split('\n').map(l => l.trim()).filter(l => l);
    const players: ParsedPlayerData[] = [];

    console.log(`Összes sor: ${lines.length}`);
    console.log(`Első 5 sor:`, lines.slice(0, 5));

    // Először próbáljuk meg tab-elválasztott formátummal
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Kihagyjuk a fejléc sorokat, csapatneveket és az üres sorokat
      if (line.includes('Közeli') || line.includes('Játékos') || line.includes('Atomerőmű') || 
          line.includes('Alba Fehérvár') || line.includes('Fejlett statisztika')) {
        i++;
        continue;
      }

      // Ellenőrizzük, hogy tartalmaz-e TAB karaktereket
      const tabParts = line.split('\t').filter(p => p.trim());
      console.log(`Sor ${i}: "${line.substring(0, 50)}..." - Tab részek: ${tabParts.length}`);
      
      // Ha van elég tab-elválasztott oszlop (>25), akkor ez egy játékos adatsora
      if (tabParts.length >= 25) {
        // Vissza kell mennünk az előző sorokhoz, hogy megkapjuk a mezo számot és nevet
        let playerNumber = -1; // -1 = még nem találtunk számot
        let playerName = '';
        
        // Az előző 4 sorban keressük a mezo számot és nevet (mert a név lehet duplikálva)
        for (let j = Math.max(0, i - 4); j < i; j++) {
          const prevLine = lines[j].trim();
          // Mezo szám (0-99)
          if (/^\d{1,2}$/.test(prevLine) && playerNumber === -1) {
            const num = parseInt(prevLine);
            if (num >= 0 && num < 100) {
              playerNumber = num;
            }
          }
          // Játékos név (nem szám, nem csillag, legalább 3 karakter)
          // Ha még nincs név VAGY ez egy másik név (nem duplikáció)
          if (prevLine && !/^\d+$/.test(prevLine) && prevLine !== '*' && prevLine.length > 2) {
            if (!playerName || prevLine !== playerName) {
              playerName = prevLine;
            }
          }
        }
        
        if (playerNumber >= 0 && playerName) {
          try {
            // Az első elem lehet csillag (kezdő jelölés), azt kihagyjuk
            let startIdx = 0;
            if (tabParts[0] === '*') {
              startIdx = 1;
            }
            
            // Összeállítjuk a parts tömböt: szám, név, adatok...
            const parts = [playerNumber.toString(), playerName, ...tabParts.slice(startIdx)];
            
            const player = parsePlayerFromParts(parts);
            if (player) {
              players.push(player);
              console.log(`✓ Játékos feldolgozva: #${player.number} - ${player.name}`);
            }
          } catch (error) {
            console.error('Hiba a játékos feldolgozásakor:', error);
          }
        }
        
        i++;
        continue;
      }

      // Ha nincs tab, akkor lehet, hogy soronként vannak az adatok (HTML másolás)
      // Keresünk egy mezo számot (1-2 digit)
      const numberMatch = line.match(/^\d{1,2}$/);
      if (numberMatch && i + 30 < lines.length) {
        try {
          // A következő 30-35 sor tartalmazza a játékos adatait
          const playerLines = lines.slice(i, i + 35);
          const player = parsePlayerFromLines(playerLines);
          if (player) {
            players.push(player);
            console.log(`✓ Játékos feldolgozva: #${player.number} - ${player.name}`);
            i += 35; // Ugrás a következő játékosra
            continue;
          }
        } catch (error) {
          console.error('Hiba a soronkénti feldolgozásnál:', error);
        }
      }

      i++;
    }

    console.log(`Összesen ${players.length} játékos feldolgozva`);
    return players;
  };

  const parsePlayerFromParts = (parts: string[]): ParsedPlayerData | null => {
    const number = parseInt(parts[0]);
    const name = parts[1]?.trim();

    // Ellenőrzések: érvényes mezo szám (0-99), érvényes név
    // Kihagyjuk az összesített sort (mezszám > 99, pl. 94 a példában)
    if (isNaN(number) || number < 0 || number > 99 || !name || name.includes('*') || /^\d+$/.test(name)) {
      console.log(`Sor kihagyva: szám=${number}, név=${name}`);
      return null;
    }

    let idx = 2;
    const points = parseInt(parts[idx++]) || 0; // K (Kosár/Pont)
    const minutes = parseInt(parts[idx++]) || 0; // P (Perc)

    // Közeli dobások (3 oszlop)
    const closeMade = parseInt(parts[idx++]) || 0;
    const closeAttempted = parseInt(parts[idx++]) || 0;
    idx++; // százalék - kihagyjuk

    // Középtávoli dobások (3 oszlop)
    const midMade = parseInt(parts[idx++]) || 0;
    const midAttempted = parseInt(parts[idx++]) || 0;
    idx++; // százalék - kihagyjuk

    // Hármasok (3 oszlop)
    const threeMade = parseInt(parts[idx++]) || 0;
    const threeAttempted = parseInt(parts[idx++]) || 0;
    idx++; // százalék - kihagyjuk

    // Büntetők (3 oszlop)
    const ftMade = parseInt(parts[idx++]) || 0;
    const ftAttempted = parseInt(parts[idx++]) || 0;
    idx++; // százalék - kihagyjuk

    // Lepattanók (3 oszlop: V, T, Ö)
    const defensiveRebounds = parseInt(parts[idx++]) || 0; // V (védekező)
    const offensiveRebounds = parseInt(parts[idx++]) || 0; // T (támadó)
    const totalRebounds = parseInt(parts[idx++]) || 0; // Ö (összes)

    // Labda (2 oszlop: EL, SZ) - Az Edwin táblázatban EL az első, SZ a második!
    const turnovers = parseInt(parts[idx++]) || 0; // EL (elvesztés) - első oszlop
    const steals = parseInt(parts[idx++]) || 0; // SZ (szerzés) - második oszlop

    // Fault (2 oszlop: SA, KI)
    const foulsDrawn = parseInt(parts[idx++]) || 0; // SA (szerzett/kapott faultok)
    const fouls = parseInt(parts[idx++]) || 0; // KI (kiosztott faultok)

    // GP (1 oszlop)
    const assists = parseInt(parts[idx++]) || 0; // Gólpassz

    // Blokk (2 oszlop: SA, KA)
    const blocksSuffered = parseInt(parts[idx++]) || 0; // SA (kapott blokkok)
    const blocksGiven = parseInt(parts[idx++]) || 0; // KA (kiosztott blokkok)

    // +/- nincs a táblázatban!
    const plusMinus = 0;

    // VAL (1 oszlop)
    const valuation = parseInt(parts[idx++]) || 0;

    // Fejlett statisztikák (4 oszlop: O.RTG, D.RTG, TS%, ES%)
    const offensiveRating = parseFloat(parts[idx++]) || 0;
    const defensiveRating = parseFloat(parts[idx++]) || 0;
    const trueShootingPct = parseFloat(parts[idx++]) || 0;
    const effectiveFGPct = parseFloat(parts[idx++]) || 0;

    return {
      number,
      name,
      minutes,
      points,
      closeMade,
      closeAttempted,
      midMade,
      midAttempted,
      threeMade,
      threeAttempted,
      ftMade,
      ftAttempted,
      defensiveRebounds,
      offensiveRebounds,
      totalRebounds,
      steals,
      turnovers,
      foulsDrawn,
      fouls,
      assists,
      blocksSuffered,
      blocksGiven,
      valuation,
      offensiveRating,
      defensiveRating,
      trueShootingPct,
      effectiveFGPct,
      plusMinus,
    };
  };

  const parsePlayerFromLines = (lines: string[]): ParsedPlayerData | null => {
    let idx = 0;

    // Mezo szám (0-99)
    const number = parseInt(lines[idx++]);
    if (isNaN(number) || number < 0 || number > 99) return null;

    // Játékos név - keressük a következő sort, ami NEM üres, NEM szám, NEM csillag
    let name = '';
    while (idx < lines.length) {
      const line = lines[idx];
      // Ha ez egy név (nem üres, nem csak számok, nem csillag)
      if (line && line !== '*' && !/^\d+(\.\d+)?$/.test(line) && line.length > 2) {
        name = line;
        idx++;
        break;
      }
      idx++;
    }

    if (!name) return null;

    // Kihagyjuk a duplikált nevet (ha van)
    if (idx < lines.length && lines[idx] === name) {
      idx++;
    }

    // Kihagyjuk a csillagot (kezdő jelölés)
    if (idx < lines.length && lines[idx] === '*') {
      idx++;
    }

    // Most jönnek a számok - gyűjtsük össze az összes számot
    const numbers: number[] = [];
    const startIdx = idx;
    while (idx < lines.length && idx - startIdx < 50) { // Max 50 sort nézünk meg
      const line = lines[idx];
      // Csak számokat veszünk figyelembe (egész vagy tizedes, lehet negatív is)
      if (line && /^-?\d+(\.\d+)?$/.test(line)) {
        numbers.push(parseFloat(line));
        // Ha már van 30 számunk, megvan minden adat
        if (numbers.length >= 30) {
          break;
        }
      }
      idx++;
    }

    console.log(`Játékos: ${name}, összegyűjtött számok: ${numbers.length}`);

    // Ellenőrizzük, hogy van-e elég adat
    if (numbers.length < 25) {
      console.log(`Túl kevés adat a játékoshoz (${name}): ${numbers.length} szám`);
      return null;
    }

    // Értelmezzük a számokat
    let numIdx = 0;
    const points = numbers[numIdx++] || 0; // K (Kosár/Pont)
    const minutes = numbers[numIdx++] || 0; // P (Perc)

    // Közeli dobások (3 oszlop)
    const closeMade = numbers[numIdx++] || 0;
    const closeAttempted = numbers[numIdx++] || 0;
    numIdx++; // százalék - kihagyjuk

    // Középtávoli (3 oszlop)
    const midMade = numbers[numIdx++] || 0;
    const midAttempted = numbers[numIdx++] || 0;
    numIdx++; // százalék - kihagyjuk

    // Hármasok (3 oszlop)
    const threeMade = numbers[numIdx++] || 0;
    const threeAttempted = numbers[numIdx++] || 0;
    numIdx++; // százalék - kihagyjuk

    // Büntetők (3 oszlop)
    const ftMade = numbers[numIdx++] || 0;
    const ftAttempted = numbers[numIdx++] || 0;
    numIdx++; // százalék - kihagyjuk

    // Lepattanók (3 oszlop: V, T, Ö)
    const defensiveRebounds = numbers[numIdx++] || 0; // V (védekező)
    const offensiveRebounds = numbers[numIdx++] || 0; // T (támadó)
    const totalRebounds = numbers[numIdx++] || 0; // Ö (összes)

    // Labda (2 oszlop: SZ, EL)
    const steals = numbers[numIdx++] || 0; // SZ (szerzés)
    const turnovers = numbers[numIdx++] || 0; // EL (elvesztés)

    // Fault (2 oszlop: SA, KI)
    const foulsDrawn = numbers[numIdx++] || 0; // SA (szerzett/kapott faultok)
    const fouls = numbers[numIdx++] || 0; // KI (kiosztott faultok)

    // GP (1 oszlop)
    const assists = numbers[numIdx++] || 0; // Gólpassz

    // Blokk (2 oszlop: SA, KA)
    const blocksSuffered = numbers[numIdx++] || 0; // SA (kapott blokkok)
    const blocksGiven = numbers[numIdx++] || 0; // KA (kiosztott blokkok)

    // +/- nincs a táblázatban!
    const plusMinus = 0;

    // VAL (1 oszlop)
    const valuation = numbers[numIdx++] || 0;

    // Fejlett statisztikák (4 oszlop: O.RTG, D.RTG, TS%, ES%)
    const offensiveRating = numbers[numIdx++] || 0;
    const defensiveRating = numbers[numIdx++] || 0;
    const trueShootingPct = numbers[numIdx++] || 0;
    const effectiveFGPct = numbers[numIdx++] || 0;

    return {
      number,
      name,
      minutes,
      points,
      closeMade,
      closeAttempted,
      midMade,
      midAttempted,
      threeMade,
      threeAttempted,
      ftMade,
      ftAttempted,
      defensiveRebounds,
      offensiveRebounds,
      totalRebounds,
      steals,
      turnovers,
      foulsDrawn,
      fouls,
      assists,
      blocksSuffered,
      blocksGiven,
      valuation,
      offensiveRating,
      defensiveRating,
      trueShootingPct,
      effectiveFGPct,
      plusMinus,
    };
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validáció
    if (!rawData) {
      toast.error('Kérlek add meg a játékosok statisztikáit!');
      return;
    }

    if (!selectedSeasonId) {
      toast.error('Kérlek válassz szezont!');
      return;
    }

    if (useExistingGame) {
      // Létező meccs használata
      if (!selectedGameId) {
        toast.error('Kérlek válassz egy meccset!');
        return;
      }
    } else {
      // Új meccs létrehozása
      if (!gameDate || !homeScore || !awayScore) {
        toast.error('Kérlek töltsd ki a meccs adatait!');
        return;
      }

      if (!homeTeamId || !awayTeamId) {
        toast.error('Kérlek válaszd ki mindkét csapatot!');
        return;
      }
    }

    setIsLoading(true);

    try {
      // 1. Adatok feldolgozása
      const players = parseTableData(rawData);

      if (players.length === 0) {
        toast.error('Nem sikerült játékosokat elemezni az adatokból!');
        setIsLoading(false);
        return;
      }

      let gameId: string;
      let importingTeamId: string;

      // Ha létező meccset használunk
      if (useExistingGame && selectedGameId) {
        // Betöltjük a meccs adatait
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', selectedGameId)
          .single();

        if (gameError || !gameData) {
          toast.error('Hiba a meccs betöltésekor!');
          setIsLoading(false);
          return;
        }

        const resolvedHomeTeamId = homeTeamId || (gameData.home_away === 'home' ? gameData.our_team_id : '');
        const resolvedAwayTeamId = awayTeamId || (gameData.home_away === 'away' ? gameData.our_team_id : '');
        importingTeamId = currentImportTeam === 'home' ? resolvedHomeTeamId : resolvedAwayTeamId;

        if (!importingTeamId) {
          toast.error('Nem sikerült meghatározni az importálandó csapatot. Ellenőrizd a hazai/vendég csapat kiválasztását!');
          setIsLoading(false);
          return;
        }

        const opponentTeamId = currentImportTeam === 'home' ? resolvedAwayTeamId : resolvedHomeTeamId;
        const opponentTeamName = teams.find(team => team.id === opponentTeamId)?.name || gameData.opponent;

        const homeScoreNum = parseInt(homeScore || '0', 10);
        const awayScoreNum = parseInt(awayScore || '0', 10);
        const importingTeamIsHome = currentImportTeam === 'home';
        const ourScoreNum = importingTeamIsHome ? homeScoreNum : awayScoreNum;
        const oppScoreNum = importingTeamIsHome ? awayScoreNum : homeScoreNum;
        const result = ourScoreNum > oppScoreNum ? 'win' : 'loss';

        const { data: targetGame, error: targetGameError } = await supabase
          .from('games')
          .select('id')
          .eq('date', gameData.date)
          .eq('season_id', gameData.season_id)
          .eq('our_team_id', importingTeamId)
          .eq('opponent', opponentTeamName)
          .maybeSingle();

        if (targetGameError) {
          toast.error(`Hiba a cél meccs azonosításakor: ${targetGameError.message}`);
          setIsLoading(false);
          return;
        }

        if (targetGame) {
          gameId = targetGame.id;
        } else {
          const { data: createdGame, error: createGameError } = await supabase
            .from('games')
            .insert({
              date: gameData.date,
              opponent: opponentTeamName,
              home_away: importingTeamIsHome ? 'home' : 'away',
              our_score: ourScoreNum,
              opp_score: oppScoreNum,
              result,
              round: gameData.round,
              season_id: gameData.season_id,
              our_team_id: importingTeamId,
            })
            .select('id')
            .single();

          if (createGameError || !createdGame) {
            toast.error(`Hiba a cél meccs létrehozásakor: ${createGameError?.message || 'ismeretlen hiba'}`);
            setIsLoading(false);
            return;
          }

          gameId = createdGame.id;
        }
        
        // Ellenőrizzük, van-e már statisztika ehhez a meccshez
        const { count } = await supabase
          .from('player_game_stats')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', gameId);

        if (count && count > 0) {
          const confirmed = window.confirm(
            `Ez a meccs már tartalmaz ${count} játékos statisztikát!\n\n` +
            `Biztosan felül szeretnéd írni a meglévő adatokat?`
          );

          if (!confirmed) {
            setIsLoading(false);
            toast.info('Importálás megszakítva');
            return;
          }

          // Töröljük a meglévő statisztikákat
          await supabase
            .from('player_game_stats')
            .delete()
            .eq('game_id', gameId);
          
          toast.info('Meglévő statisztikák törölve, új adatok importálása...');
        }
      } else {
        // Új meccs létrehozása
        const homeScoreNum = parseInt(homeScore);
        const awayScoreNum = parseInt(awayScore);
        
        // Melyik csapat adatait importáljuk?
        importingTeamId = currentImportTeam === 'home' ? homeTeamId! : awayTeamId!;
        const importingTeamIsHome = currentImportTeam === 'home';
        const ourScoreNum = importingTeamIsHome ? homeScoreNum : awayScoreNum;
        const oppScoreNum = importingTeamIsHome ? awayScoreNum : homeScoreNum;
        const result = ourScoreNum > oppScoreNum ? 'win' : 'loss';
        const opponentTeamName = teams.find(t => t.id === (importingTeamIsHome ? awayTeamId : homeTeamId))?.name || 'Ismeretlen';

        // 2. Ellenőrizzük, létezik-e már ilyen meccs erre a csapatra ezen a dátumon
        const { data: existingGame } = await supabase
          .from('games')
          .select('id')
          .eq('date', gameDate)
          .eq('season_id', selectedSeasonId)
          .eq('our_team_id', importingTeamId)
          .single();

        if (existingGame) {
          // Ellenőrizzük, van-e már statisztika ehhez a meccshez
          const { count } = await supabase
            .from('player_game_stats')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', existingGame.id);

          if (count && count > 0) {
            const confirmed = window.confirm(
              `Ez a meccs már létezik ${count} játékos statisztikával!\n\n` +
              `Dátum: ${gameDate}\n` +
              `Csapat: ${teams.find(t => t.id === importingTeamId)?.name}\n\n` +
              `Biztosan felül szeretnéd írni a meglévő adatokat?`
            );

            if (!confirmed) {
              setIsLoading(false);
              toast.info('Importálás megszakítva');
              return;
            }

            // Töröljük a meglévő statisztikákat
            await supabase
              .from('player_game_stats')
              .delete()
              .eq('game_id', existingGame.id);
          
            toast.info('Meglévő statisztikák törölve, új adatok importálása...');
          }
        
          // Ha létezik, használjuk azt
          gameId = existingGame.id;
        } else {
          // Ha nem létezik, létrehozzuk
          const { data: gameData, error: gameError } = await supabase
            .from('games')
            .insert({
              date: gameDate,
              opponent: opponentTeamName,
              home_away: importingTeamIsHome ? 'home' : 'away',
              our_score: ourScoreNum,
              opp_score: oppScoreNum,
              result: result,
              round: round ? parseInt(round) : null,
              season_id: selectedSeasonId,
              our_team_id: importingTeamId,
            })
            .select()
            .single();

          if (gameError) throw gameError;
          gameId = gameData.id;
        }
      }

      // 3. Játékosok ellenőrzése és beszúrása - SZEZON ÉS CSAPAT SZERINT!
      for (const player of players) {
        const normalizedIncomingName = normalizePlayerNameForMatch(player.name);

        // Első kör: mezszám szerinti találatok a csapatban/szezonban.
        const { data: sameNumberPlayers, error: sameNumberError } = await supabase
          .from('players')
          .select('id, name, number')
          .eq('number', player.number)
          .eq('season_id', selectedSeasonId)
          .eq('team_id', importingTeamId);

        if (sameNumberError) {
          console.error(`Hiba a játékos lekérdezésekor (${player.name}):`, sameNumberError);
          continue;
        }

        let matchedPlayer: { id: string; name: string; number: number | null } | null = (sameNumberPlayers || []).find(
          candidate => normalizePlayerNameForMatch(candidate.name) === normalizedIncomingName
        ) || sameNumberPlayers?.[0] || null;

        // Második kör: ha nincs mezszámos találat, név szerinti egyezés.
        if (!matchedPlayer) {
          const { data: sameNamePlayers, error: sameNameError } = await supabase
            .from('players')
            .select('id, name, number')
            .eq('season_id', selectedSeasonId)
            .eq('team_id', importingTeamId)
            .ilike('name', player.name);

          if (sameNameError) {
            console.error(`Hiba a név szerinti játékos lekérdezésekor (${player.name}):`, sameNameError);
          } else {
            matchedPlayer = (sameNamePlayers || []).find(
              candidate => normalizePlayerNameForMatch(candidate.name) === normalizedIncomingName
            ) || null;
          }
        }

        let playerId: string;

        if (matchedPlayer) {
          playerId = matchedPlayer.id;
          console.log(`Játékos már létezik: #${player.number} - ${player.name}`);

          if (normalizePlayerNameForMatch(matchedPlayer.name) !== normalizedIncomingName) {
            const { error: renameError } = await supabase
              .from('players')
              .update({ name: player.name })
              .eq('id', playerId);

            if (renameError) {
              console.warn(`Névformátum frissítés nem sikerült (${player.name}):`, renameError.message);
            }
          }
        } else {
          // Megpróbáljuk meghatározni a pozíciót a mezo alapján (alapértelmezett: G)
          let position: 'G' | 'F' | 'C' = 'G';
          if (player.totalRebounds > 8) {
            position = 'C';
          } else if (player.assists < 2 && player.totalRebounds > 5) {
            position = 'F';
          }

          const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert({
              name: player.name,
              number: player.number,
              position: position,
              season_id: selectedSeasonId,
              team_id: importingTeamId,
            })
            .select()
            .single();

          if (playerError) {
            console.error(`Hiba a játékos beszúrásakor (${player.name}):`, playerError);
            continue;
          }

          playerId = newPlayer.id;
        }

        // Ellenőrizzük, hogy már létezik-e ugyanez a játékos ugyanebben a meccsen
        const { data: existingStat } = await supabase
          .from('player_game_stats')
          .select('id')
          .eq('game_id', gameId)
          .eq('player_id', playerId)
          .maybeSingle();

        if (existingStat) {
          console.log(`Statisztika már létezik ehhez a játékoshoz ebben a meccsen: ${player.name}`);
          continue;
        }

        // 4. Játékos teljesítmény beszúrása
        const { error: statsError } = await supabase
          .from('player_game_stats')
          .insert({
            game_id: gameId,
            player_id: playerId,
            minutes: player.minutes,
            points: player.points,
            close_made: player.closeMade,
            close_attempted: player.closeAttempted,
            mid_made: player.midMade,
            mid_attempted: player.midAttempted,
            three_made: player.threeMade,
            three_attempted: player.threeAttempted,
            free_throw_made: player.ftMade,
            free_throw_attempted: player.ftAttempted,
            offensive_rebounds: player.offensiveRebounds,
            defensive_rebounds: player.defensiveRebounds,
            total_rebounds: player.totalRebounds,
            assists: player.assists,
            steals: player.steals,
            blocks: player.blocksSuffered, // Saját blokkok (SA) = amit a játékos blokkolt
            blocks_suffered: player.blocksSuffered,
            blocks_given: player.blocksGiven,
            turnovers: player.turnovers,
            fouls_drawn: player.foulsDrawn,
            fouls_committed: player.fouls,
            plus_minus: player.plusMinus,
            valuation: player.valuation,
            offensive_rating: player.offensiveRating,
            defensive_rating: player.defensiveRating,
            true_shooting_percentage: player.trueShootingPct,
            effective_field_goal_percentage: player.effectiveFGPct,
          });

        if (statsError) {
          console.error(`Hiba a statisztika beszúrásakor (${player.name}):`, statsError);
          console.error('Játékos adatok:', player);
          console.error('Game ID:', gameId);
          console.error('Player ID:', playerId);
        }
      }

      const importedTeamName = teams.find(t => t.id === importingTeamId)?.name || 'Csapat';
      toast.success(`${importedTeamName} adatai sikeresen importálva! ${players.length} játékos feldolgozva.`);

      // Csak a táblázat mezőt töröljük, hogy a másik csapat adatait is be lehessen illeszteni
      setRawData('');

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Hiba az importálás során:', error);
      toast.error('Hiba történt az importálás során!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-slate-50 mb-2 flex items-center gap-2">
          <FileJson size={24} />
          Gyors Adatfelvitel Táblázatból
        </h2>
        <p className="text-slate-400">Másold be a statisztikai táblázatot és importáld az adatbázisba</p>
      </div>

      <form onSubmit={handleImport} className="space-y-6">
        {/* Meccs információk */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Meccs információk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Választás: Létező meccs vagy új */}
            <div className="space-y-2">
              <Label className="text-slate-300">Meccs típusa</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUseExistingGame(false)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    !useExistingGame
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">Új meccs</div>
                  <div className="text-sm opacity-80">Meccs adatok kitöltése</div>
                </button>
                <button
                  type="button"
                  onClick={() => setUseExistingGame(true)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    useExistingGame
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">Létező meccs</div>
                  <div className="text-sm opacity-80">Válassz a listából</div>
                </button>
              </div>
            </div>

            {/* Szezon kiválasztása mindig */}
            <div className="space-y-2">
              <Label htmlFor="season" className="text-slate-300">
                Szezon *
              </Label>
              <Select value={selectedSeasonId || ''} onValueChange={setSelectedSeasonId}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Válassz szezont..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {seasons.map(season => (
                    <SelectItem 
                      key={season.id} 
                      value={season.id}
                      className="text-slate-200 focus:bg-slate-700"
                    >
                      {season.name} {season.is_current && '(Jelenlegi)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Létező meccs kiválasztása */}
            {useExistingGame && (
              <div className="space-y-2">
                <Label htmlFor="existingGame" className="text-slate-300">
                  Válassz meccset *
                </Label>
                <Select value={selectedGameId || ''} onValueChange={handleSelectExistingGame}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Válassz meccset..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {existingGames.map(game => (
                      <SelectItem 
                        key={game.id} 
                        value={game.id}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        {game.date} - {game.opponent} ({game.our_score}:{game.opp_score}) {game.round ? `- ${game.round}. forduló` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Új meccs mezői */}
            {!useExistingGame && (
              <>
            {/* Első sor: Dátum és Forduló */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="date" className="text-slate-300">
                  Dátum *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                  required={!useExistingGame}
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round" className="text-slate-300">
                  Forduló
                </Label>
                <Input
                  id="round"
                  type="number"
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  placeholder="pl. 5"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            </div>

            {/* Második sor: Hazai csapat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="homeTeam" className="text-slate-300">
                  Hazai csapat *
                </Label>
                <Select value={homeTeamId || ''} onValueChange={setHomeTeamId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Válassz hazai csapatot..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {teams.map(team => (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                      >
                        {team.name} {team.is_primary && '⭐'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="homeScore" className="text-slate-300">
                  Hazai pont *
                </Label>
                <Input
                  id="homeScore"
                  type="number"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  required={!useExistingGame}
                  placeholder="pl. 85"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            </div>

            {/* Harmadik sor: Vendég csapat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="awayTeam" className="text-slate-300">
                  Vendég csapat *
                </Label>
                <Select value={awayTeamId || ''} onValueChange={setAwayTeamId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="Válassz vendég csapatot..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {teams.map(team => (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                      >
                        {team.name} {team.is_primary && '⭐'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="awayScore" className="text-slate-300">
                  Vendég pont *
                </Label>
                <Input
                  id="awayScore"
                  type="number"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  required={!useExistingGame}
                  placeholder="pl. 78"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            </div>
            </>
            )}

            {/* Negyedik sor: Melyik csapat adatait importáljuk */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                Melyik csapat játékosait importálod most? *
              </Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentImportTeam('home')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    currentImportTeam === 'home'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">Hazai csapat</div>
                  <div className="text-sm opacity-80">
                    {teams.find(t => t.id === homeTeamId)?.name || 'Válassz csapatot'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentImportTeam('away')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    currentImportTeam === 'away'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">Vendég csapat</div>
                  <div className="text-sm opacity-80">
                    {teams.find(t => t.id === awayTeamId)?.name || 'Válassz csapatot'}
                  </div>
                </button>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                💡 Tipp: Importáld először az egyik csapat adatait, majd válts át a másikra és importáld azokat is!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Táblázat bemásolása */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-slate-50">Statisztikai táblázat</CardTitle>
                <p className="text-slate-400 text-sm mt-2">
                  Másold be a teljes táblázatot (a fejléccel együtt vagy anélkül). A formátum lehet tab vagy space elválasztott.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                variant="outline"
                className="bg-slate-800 border-slate-700 hover:bg-slate-700"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="mr-2" size={16} />
                    Előnézet elrejtése
                  </>
                ) : (
                  <>
                    <Eye className="mr-2" size={16} />
                    Előnézet mutatása
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={rawData}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRawData(e.target.value)}
              required
              rows={15}
              placeholder="Példa formátum:&#10;2  Bluiett Trevon Nykee  16  44  1  3  33.3  0  2  0  3  9  33.3  5  7  71.4  3  1  4  2  1  3  4  2  0  0  15  99.2  100.6  50  39.3&#10;7  Eilingsfeld János  10  43  2  3  66.7  0  1  0  1  5  20  3  4  75  4  1  5  1  1  2  4  2  0  1  14  80.5  101.7  45.5  38.9&#10;..."
              className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs"
            />
          </CardContent>
        </Card>

        {/* Preview táblázat */}
        {showPreview && previewData.length > 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50">Import előnézet ({previewData.length} játékos)</CardTitle>
              <p className="text-slate-400 text-sm mt-2">
                Ellenőrizd az adatokat importálás előtt! Különösen figyelj a <strong className="text-amber-400">gólpasszokra (GP)</strong>.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-2 text-slate-400 sticky left-0 bg-slate-900 z-10" rowSpan={2}>#</th>
                      <th className="text-left p-2 text-slate-400 sticky left-8 bg-slate-900 z-10" rowSpan={2}>Név</th>
                      <th className="text-right p-2 text-slate-400 bg-slate-800" rowSpan={2}>Pont</th>
                      <th className="text-right p-2 text-slate-400 bg-slate-800" rowSpan={2}>Perc</th>
                      <th className="text-center p-2 text-slate-400 border-l border-slate-700" colSpan={2}>Közeli</th>
                      <th className="text-center p-2 text-slate-400" colSpan={2}>Közepes</th>
                      <th className="text-center p-2 text-slate-400" colSpan={2}>Hármas</th>
                      <th className="text-center p-2 text-slate-400 border-r border-slate-700" colSpan={2}>Büntető</th>
                      <th className="text-center p-2 text-slate-400 border-l border-slate-700" colSpan={3}>Lepattanó</th>
                      <th className="text-center p-2 text-slate-400 bg-green-900/10 border-l border-slate-700" colSpan={2}>Labda</th>
                      <th className="text-center p-2 text-slate-400 border-l border-slate-700" colSpan={2}>Fault</th>
                      <th className="text-right p-2 text-slate-400 bg-amber-900/30 border-l border-slate-700" rowSpan={2}>GP</th>
                      <th className="text-center p-2 text-slate-400 border-l border-slate-700" colSpan={2}>Blokk</th>
                      <th className="text-right p-2 text-slate-400 bg-purple-900/20 border-l border-slate-700" rowSpan={2}>VAL</th>
                      <th className="text-center p-2 text-slate-400 bg-blue-900/10 border-l border-slate-700" colSpan={4}>Fejlett stat</th>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <th className="text-right p-1 text-slate-500 text-[10px]">S/K</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">%</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">S/K</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">%</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">S/K</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">%</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">S/K</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">%</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">V</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">T</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">Ö</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-green-900/20">SZ</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-red-900/20">EL</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">SA</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">KI</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">SA</th>
                      <th className="text-right p-1 text-slate-500 text-[10px]">KA</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-emerald-900/20">ORtg</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-sky-900/20">DRtg</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-violet-900/20">TS%</th>
                      <th className="text-right p-1 text-slate-500 text-[10px] bg-orange-900/20">eFG%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((player, idx) => {
                      const closePerc = player.closeAttempted > 0 ? ((player.closeMade / player.closeAttempted) * 100).toFixed(1) : '0.0';
                      const midPerc = player.midAttempted > 0 ? ((player.midMade / player.midAttempted) * 100).toFixed(1) : '0.0';
                      const threePerc = player.threeAttempted > 0 ? ((player.threeMade / player.threeAttempted) * 100).toFixed(1) : '0.0';
                      const ftPerc = player.ftAttempted > 0 ? ((player.ftMade / player.ftAttempted) * 100).toFixed(1) : '0.0';
                      const isTotal = player.number > 99; // Összesített sor
                      
                      return (
                        <tr key={idx} className={`border-b border-slate-800 ${isTotal ? 'bg-slate-700/50 font-semibold' : 'hover:bg-slate-800/50'}`}>
                          <td className="p-2 text-slate-300 sticky left-0 bg-slate-900">{isTotal ? '-' : player.number}</td>
                          <td className="p-2 text-slate-100 sticky left-8 bg-slate-900 min-w-30">{isTotal ? 'ÖSSZESÍTETT' : player.name}</td>
                          <td className="text-right p-2 text-slate-100 font-semibold bg-slate-800">{player.points}</td>
                          <td className="text-right p-2 text-slate-300 bg-slate-800">{player.minutes}</td>
                          <td className="text-right p-2 text-slate-400 border-l border-slate-800">{player.closeMade}/{player.closeAttempted}</td>
                          <td className="text-right p-2 text-slate-400">{closePerc}%</td>
                          <td className="text-right p-2 text-slate-400">{player.midMade}/{player.midAttempted}</td>
                          <td className="text-right p-2 text-slate-400">{midPerc}%</td>
                          <td className="text-right p-2 text-slate-400">{player.threeMade}/{player.threeAttempted}</td>
                          <td className="text-right p-2 text-slate-400">{threePerc}%</td>
                          <td className="text-right p-2 text-slate-400">{player.ftMade}/{player.ftAttempted}</td>
                          <td className="text-right p-2 text-slate-400 border-r border-slate-800">{ftPerc}%</td>
                          <td className="text-right p-2 text-slate-300 border-l border-slate-800">{player.defensiveRebounds}</td>
                          <td className="text-right p-2 text-slate-300">{player.offensiveRebounds}</td>
                          <td className="text-right p-2 text-slate-300 font-semibold">{player.totalRebounds}</td>
                          <td className="text-right p-2 text-green-400 bg-green-900/20 border-l border-slate-800 font-semibold">{player.steals}</td>
                          <td className="text-right p-2 text-red-400 bg-red-900/20 font-semibold">{player.turnovers}</td>
                          <td className="text-right p-2 text-slate-400">{player.foulsDrawn}</td>
                          <td className="text-right p-2 text-slate-300">{player.fouls}</td>
                          <td className="text-right p-2 text-amber-400 font-bold bg-amber-900/30 text-base border-l border-slate-800">{player.assists}</td>
                          <td className="text-right p-2 text-slate-400 border-l border-slate-800">{player.blocksSuffered}</td>
                          <td className="text-right p-2 text-slate-400">{player.blocksGiven}</td>
                          <td className="text-right p-2 text-purple-400 font-bold bg-purple-900/20 text-base border-l border-slate-800">{player.valuation}</td>
                          <td className="text-right p-2 text-emerald-400 bg-emerald-900/20 border-l border-slate-800">{player.offensiveRating.toFixed(1)}</td>
                          <td className="text-right p-2 text-sky-400 bg-sky-900/20">{player.defensiveRating.toFixed(1)}</td>
                          <td className="text-right p-2 text-violet-400 bg-violet-900/20">{player.trueShootingPct.toFixed(1)}%</td>
                          <td className="text-right p-2 text-orange-400 bg-orange-900/20">{player.effectiveFGPct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <p className="text-sm text-blue-200 font-semibold mb-2">
                    📊 Importált oszlopok:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-100">
                    <div>✅ Pont, Perc</div>
                    <div>✅ Dobások (Köz, Kö, 3P, BÜ)</div>
                    <div>✅ Lepattanók (V, T, Ö)</div>
                    <div>✅ Labda SZ, EL</div>
                    <div>✅ Fault SA (szerzett), KI (kiosztott)</div>
                    <div className="text-amber-300 font-semibold">✅ GP (Gólpassz)</div>
                    <div>✅ Blokk SA (kapott), KA (kiosztott)</div>
                    <div className="text-purple-300 font-semibold">✅ VAL (Értékelés)</div>
                    <div>✅ Fejlett stat (ORtg, DRtg, TS%, eFG%)</div>
                  </div>
                </div>
                
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <p className="text-sm text-slate-300 font-semibold mb-2">
                    ⚠️ NEM importált oszlopok:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>❌ +/- (nincs a táblázatban)</div>
                    <div>❌ Összesített sor (automatikusan kihagyva)</div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    💡 Az összesített sor (94 200...) megjelenik az előnézetben &quot;ÖSSZESÍTETT&quot; névvel, de nem kerül az adatbázisba.
                  </p>
                </div>

                <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                  <p className="text-sm text-amber-200 font-semibold mb-2">
                    ✓ Ellenőrzési pontok importálás előtt:
                  </p>
                  <ul className="list-disc list-inside text-xs text-amber-200 space-y-1">
                    <li><strong className="text-purple-400">VAL (lila):</strong> 5-30 között? (Ha 100+, rossz az oszlopsorrend!)</li>
                    <li><strong className="text-amber-400">GP (sárga):</strong> 0-15? Irányítóknál magasabb?</li>
                    <li><strong className="text-green-400">SZ (zöld, Labda alatt):</strong> 0-5 tartomány?</li>
                    <li><strong className="text-red-400">EL (piros, Labda alatt):</strong> Összhangban a percekkel?</li>
                    <li><strong>Fault SA:</strong> Szerzett faultok (ritkább, 0-5)</li>
                    <li><strong>Blokk SA/KA:</strong> Most már importálva (0-3 tartomány)</li>
                    <li><strong>ORtg, DRtg:</strong> 70-150 között?</li>
                    <li><strong>TS%, eFG%:</strong> 20-80% között?</li>
                    <li><strong>Összesített sor:</strong> Látható az előnézetben, de NEM importálódik</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={20} />
                Importálás...
              </>
            ) : (
              <>
                <Upload className="mr-2" size={20} />
                Adatok importálása
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
