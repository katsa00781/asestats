import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

type ImportPayload = {
  mode?: 'search' | 'import';
  playerName?: string;
  profileUrl?: string;
  seasonYear?: number;
  maxCandidates?: number;
};

type PlayerCandidate = {
  name: string;
  profileUrl: string;
  height?: string;
  position?: string;
  born?: string;
  nationality?: string;
  team?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
  flagUrl?: string;
  photoUrl?: string;
};

type ImportResult = {
  name: string;
  position?: string;
  currentTeam?: string;
  currentCountry?: string;
  currentCountryFlagUrl?: string;
  previousTeam?: string;
  previousCountry?: string;
  previousCountryFlagUrl?: string;
  games: number;
  minutesPerGame: number;
  pointsPerGame: number;
  assistsPerGame: number;
  orebPerGame: number;
  drebPerGame: number;
  valuationPerGame: number;
  twoPct: number;
  twoAttemptedPerGame: number;
  threePct: number;
  threeAttemptedPerGame: number;
  ftPct: number;
  ftAttemptedPerGame: number;
  turnoversPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  foulsCommittedPerGame: number;
  foulsReceivedPerGame: number;
  sourceUrl: string;
  seasonYearUsed: number;
  usedFallbackSeason: boolean;
  gamesSampled: number;
};

type CareerEntry = {
  season: string;
  team: string;
  league: string;
};

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,hu;q=0.8',
};

const round = (value: number, digits = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const cleanText = (value: string) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumber = (value: string) => {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned || cleaned === '**' || cleaned === '*.*') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseShotPair = (value: string) => {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
  if (!match) return { made: 0, attempted: 0 };
  const made = parseNumber(match[1]) ?? 0;
  const attempted = parseNumber(match[2]) ?? 0;
  return { made, attempted };
};

const extractPosition = (html: string) => {
  const faqMatch = html.match(/What position did[\s\S]*?play\?<\/h3>\s*<p>([\s\S]*?)<\/p>/i);
  if (!faqMatch) return undefined;
  return cleanText(faqMatch[1]);
};

const extractName = (html: string, fallback: string) => {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return fallback;
  const text = cleanText(h1Match[1]);
  return text || fallback;
};

const extractPhotoUrl = (html: string) => {
  const directPhotoMatch = html.match(/https?:\/\/www\.eurobasket\.com\/photos\/[^"'\s>]+\.(?:png|jpe?g|webp)/i);
  if (directPhotoMatch?.[0]) return directPhotoMatch[0];

  const altPhotoMatch = html.match(/https?:\/\/www\.eurobasket\.com\/images\/players\/[^"'\s>]+\.(?:png|jpe?g|webp)/i);
  if (altPhotoMatch?.[0]) return altPhotoMatch[0];

  return undefined;
};

const buildCountryFlagUrl = (country?: string) => {
  if (!country) return undefined;
  const normalized = cleanText(country).toLowerCase();
  const flagSlugMap: Record<string, string> = {
    usa: 'USA',
    'u.s.a.': 'USA',
    'united states': 'USA',
    'united states of america': 'USA',
    uk: 'United-Kingdom',
    'great britain': 'United-Kingdom',
    'czech republic': 'Czech-Republic',
    bosnia: 'Bosnia-and-Herzegovina',
    'bosnia and herzegovina': 'Bosnia-and-Herzegovina',
  };
  const mappedSlug = flagSlugMap[normalized];

  const slug = (mappedSlug || cleanText(country))
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z-]/g, '');
  if (!slug) return undefined;
  return `https://www.eurobasket.com/images/leagueslogos/${slug}.png`;
};

const extractCountryFlagUrl = (html: string) => {
  const navFlagMatch = html.match(/<li[^>]*class="[^"]*navFlag[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
  if (navFlagMatch?.[1]) return navFlagMatch[1];

  const leagueFlagMatch = html.match(/https?:\/\/www\.eurobasket\.com\/images\/leagueslogos\/[^"'\s>]+\.(?:png|jpe?g|svg)/i);
  if (leagueFlagMatch?.[0]) return leagueFlagMatch[0];

  return undefined;
};

const COUNTRY_CODE_MAP: Record<string, string> = {
  HUN: 'Hungary',
  CYP: 'Cyprus',
  SRB: 'Serbia',
  CRO: 'Croatia',
  SLO: 'Slovenia',
  CZE: 'Czech Republic',
  POL: 'Poland',
  GER: 'Germany',
  FRA: 'France',
  ESP: 'Spain',
  ITA: 'Italy',
  GRE: 'Greece',
  TUR: 'Turkey',
  ISR: 'Israel',
  USA: 'USA',
  CAN: 'Canada',
};

const countryFromLeagueCode = (league?: string) => {
  if (!league) return undefined;
  const code = league.trim().toUpperCase().split('-')[0];
  if (!code || code.length < 3) return undefined;
  return COUNTRY_CODE_MAP[code];
};

const extractProfileCountry = (html: string) => {
  const varMatch = html.match(/var\s+Country_SP\s*=\s*['"]([^'"]+)['"]/i);
  if (varMatch?.[1]) return cleanText(varMatch[1]);

  const urlMatch = html.match(/https?:\/\/www\.eurobasket\.com\/([A-Za-z-]+)\/basketball\.aspx/i);
  if (urlMatch?.[1]) return cleanText(urlMatch[1].replace(/-/g, ' '));

  return undefined;
};

const isLikelyCountryName = (value?: string) => {
  if (!value) return false;
  const cleaned = cleanText(value);
  if (!cleaned) return false;
  if (/\d/.test(cleaned)) return false;
  if (/(division|league|cup|conference|superleague|pro\s*[ab]|ncaa|eurocup|euroleague)/i.test(cleaned)) {
    return false;
  }
  return cleaned.split(' ').length <= 3;
};

const extractCurrentTeamCountryFromSeo = (html: string) => {
  const seoMatch = html.match(/<div[^>]*class="newseotxt"[^>]*>([\s\S]*?)<\/div>/i);
  if (!seoMatch?.[1]) return {} as { currentTeam?: string; currentCountry?: string };

  const seo = seoMatch[1];

  const teamCountryMatch = seo.match(/(?:most\s+recently\s+played\s+at|currently\s+plays\s+for)\s*<a[^>]*>([^<]+)<\/a>\s*in\s*([^.<]+)/i);
  if (teamCountryMatch) {
    const rawCountry = cleanText(teamCountryMatch[2]);
    return {
      currentTeam: cleanText(teamCountryMatch[1]),
      currentCountry: isLikelyCountryName(rawCountry) ? rawCountry : undefined,
    };
  }

  return {} as { currentTeam?: string; currentCountry?: string };
};

const extractCareerEntries = (html: string): CareerEntry[] => {
  const tableMatch = html.match(/<table[^>]*id="averagecareerstatstbl"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch?.[0]) return [];

  const rows: CareerEntry[] = [];
  const rowRegex = /<tr[^>]*class="my_pStats(?:1|2)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableMatch[0])) !== null) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }

    if (cells.length < 3) continue;

    const season = cells[0];
    const team = cells[1];
    const league = cells[2];
    if (!season || !team || !league) continue;
    if (/all\s+teams/i.test(team)) continue;

    rows.push({ season, team, league });
  }

  return rows;
};

const extractCareerContext = (html: string) => {
  const seo = extractCurrentTeamCountryFromSeo(html);
  const profileCountry = extractProfileCountry(html);
  const profileCountryFlag = extractCountryFlagUrl(html);
  const entries = extractCareerEntries(html);

  const currentEntry = entries[0];
  const previousEntry = entries.find(entry => entry.team !== currentEntry?.team || entry.league !== currentEntry?.league);

  const currentCountry = profileCountry || seo.currentCountry || countryFromLeagueCode(currentEntry?.league);
  const previousCountry = countryFromLeagueCode(previousEntry?.league);

  return {
    currentTeam: seo.currentTeam || currentEntry?.team,
    currentCountry,
    currentCountryFlagUrl: profileCountryFlag || buildCountryFlagUrl(currentCountry),
    previousTeam: previousEntry?.team,
    previousCountry,
    previousCountryFlagUrl: buildCountryFlagUrl(previousCountry),
  };
};

type ParsedGameRow = {
  date: Date;
  minutes: number;
  points: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  oreb: number;
  dreb: number;
  treb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  valuation: number;
};

const extractGameRows = (html: string): ParsedGameRow[] => {
  const rows: ParsedGameRow[] = [];
  const rowRegex = /<tr[^>]*class="my_pStats(?:1|2)"[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }

    if (cells.length < 18) continue;
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cells[0])) continue;

    const date = new Date(cells[0]);
    if (Number.isNaN(date.getTime())) continue;

    const minutes = parseNumber(cells[4]) ?? 0;
    const points = parseNumber(cells[5]) ?? 0;
    const two = parseShotPair(cells[6]);
    const three = parseShotPair(cells[7]);
    const ft = parseShotPair(cells[8]);

    rows.push({
      date,
      minutes,
      points,
      twoMade: two.made,
      twoAttempted: two.attempted,
      threeMade: three.made,
      threeAttempted: three.attempted,
      ftMade: ft.made,
      ftAttempted: ft.attempted,
      oreb: parseNumber(cells[9]) ?? 0,
      dreb: parseNumber(cells[10]) ?? 0,
      treb: parseNumber(cells[11]) ?? 0,
      assists: parseNumber(cells[12]) ?? 0,
      steals: parseNumber(cells[13]) ?? 0,
      blocks: parseNumber(cells[14]) ?? 0,
      turnovers: parseNumber(cells[15]) ?? 0,
      fouls: parseNumber(cells[16]) ?? 0,
      valuation: parseNumber(cells[17]) ?? 0,
    });
  }

  return rows;
};

const searchPlayersByName = async (playerName: string) => {
  const body = new URLSearchParams({
    SearchType: 'Player',
    txtSearch: playerName,
    SearchFrom: 'Name',
  });

  const response = await fetch('https://www.eurobasket.com/basketball-search.aspx', {
    method: 'POST',
    headers: {
      ...BROWSER_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://www.eurobasket.com/',
      Origin: 'https://www.eurobasket.com',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const location = response.headers.get('location')?.trim();
  if (location) {
    const resolved = new URL(location, 'https://www.eurobasket.com').toString();
    if (/\/player\//i.test(resolved)) {
      const fallbackName = playerName.split(/\s+/).reverse().join(' ').trim() || playerName;
      return {
        candidates: [{
          name: fallbackName,
          profileUrl: resolved,
        } satisfies PlayerCandidate],
        redirected: true,
      };
    }
  }

  const text = await response.text();
  const tableMatch = text.match(/<table[^>]*class="searchtable"[^>]*>[\s\S]*?<\/table>/i);

  if (tableMatch) {
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    const rows: PlayerCandidate[] = [];
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableMatch[0])) !== null) {
      const rawRow = rowMatch[1];
      if (/<th>/i.test(rawRow)) continue;

      const cells: string[] = [];
      const rawCells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rawRow)) !== null) {
        rawCells.push(cellMatch[1]);
        cells.push(cleanText(cellMatch[1]));
      }

      if (cells.length < 6) continue;

      const profileMatch = rawCells[0]?.match(/href\s*=\s*"([^"]+\/player\/[^"#?\s]+)"/i);
      if (!profileMatch?.[1]) continue;

      const profileUrl = normalizeProfileUrl(profileMatch[1]);
      if (!profileUrl) continue;

      const flagMatch = rawCells[4]?.match(/<img[^>]+src="([^"]+)"/i);

      rows.push({
        name: cells[0],
        profileUrl,
        height: cells[1] || undefined,
        position: cells[2] || undefined,
        born: cells[3] || undefined,
        nationality: cells[4] || undefined,
        team: cells[5] || undefined,
        flagUrl: flagMatch?.[1],
      });
    }

    if (rows.length > 0) {
      return { candidates: rows, redirected: false };
    }
  }

  const match = text.match(/https?:\/\/basketball\.[a-z-]+-basket\.com\/player\/[^"'\s<]+/i)
    || text.match(/https?:\/\/basketball\.eurobasket\.com\/player\/[^"'\s<]+/i);

  if (match?.[0]) {
    return {
      candidates: [{
        name: playerName,
        profileUrl: match[0],
      } satisfies PlayerCandidate],
      redirected: false,
    };
  }

  throw new Error('Nem találtam játékos profilt erre a névre az Eurobasket keresőben.');
};

const normalizeProfileUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const fetchProfileHtml = async (profileUrl: string) => {
  const profileResponse = await fetch(profileUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: 'https://www.eurobasket.com/',
    },
    redirect: 'follow',
  });

  if (!profileResponse.ok) {
    throw new Error(`Nem sikerült letölteni a játékos oldalt (${profileResponse.status}).`);
  }

  const html = await profileResponse.text();
  return {
    html,
    resolvedUrl: profileResponse.url || profileUrl,
  };
};

const enrichCandidatesWithPhotos = async (candidates: PlayerCandidate[], maxCandidates = 12) => {
  const limited = candidates.slice(0, Math.max(1, Math.min(30, maxCandidates)));

  const enriched = await Promise.all(
    limited.map(async candidate => {
      try {
        const { html, resolvedUrl } = await fetchProfileHtml(candidate.profileUrl);
        const career = extractCareerContext(html);
        return {
          ...candidate,
          profileUrl: resolvedUrl,
          photoUrl: extractPhotoUrl(html),
          ...career,
          currentCountryFlagUrl: career.currentCountryFlagUrl || candidate.flagUrl,
        } satisfies PlayerCandidate;
      } catch {
        return candidate;
      }
    })
  );

  return enriched;
};

const buildImportResult = (
  name: string,
  position: string | undefined,
  career: {
    currentTeam?: string;
    currentCountry?: string;
    currentCountryFlagUrl?: string;
    previousTeam?: string;
    previousCountry?: string;
    previousCountryFlagUrl?: string;
  },
  sourceUrl: string,
  rows: ParsedGameRow[],
  seasonYear: number,
  usedFallbackSeason: boolean
): ImportResult => {
  const games = rows.length;
  const totals = rows.reduce(
    (acc, row) => {
      acc.minutes += row.minutes;
      acc.points += row.points;
      acc.twoMade += row.twoMade;
      acc.twoAttempted += row.twoAttempted;
      acc.threeMade += row.threeMade;
      acc.threeAttempted += row.threeAttempted;
      acc.ftMade += row.ftMade;
      acc.ftAttempted += row.ftAttempted;
      acc.oreb += row.oreb;
      acc.dreb += row.dreb;
      acc.treb += row.treb;
      acc.assists += row.assists;
      acc.steals += row.steals;
      acc.blocks += row.blocks;
      acc.turnovers += row.turnovers;
      acc.fouls += row.fouls;
      acc.valuation += row.valuation;
      return acc;
    },
    {
      minutes: 0,
      points: 0,
      twoMade: 0,
      twoAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      oreb: 0,
      dreb: 0,
      treb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      valuation: 0,
    }
  );

  const safeGames = Math.max(games, 1);
  return {
    name,
    position,
    currentTeam: career.currentTeam,
    currentCountry: career.currentCountry,
    currentCountryFlagUrl: career.currentCountryFlagUrl,
    previousTeam: career.previousTeam,
    previousCountry: career.previousCountry,
    previousCountryFlagUrl: career.previousCountryFlagUrl,
    games,
    minutesPerGame: round(totals.minutes / safeGames),
    pointsPerGame: round(totals.points / safeGames),
    assistsPerGame: round(totals.assists / safeGames),
    orebPerGame: round(totals.oreb / safeGames),
    drebPerGame: round(totals.dreb / safeGames),
    valuationPerGame: round(totals.valuation / safeGames),
    twoPct: round(totals.twoAttempted > 0 ? (totals.twoMade / totals.twoAttempted) * 100 : 0),
    twoAttemptedPerGame: round(totals.twoAttempted / safeGames),
    threePct: round(totals.threeAttempted > 0 ? (totals.threeMade / totals.threeAttempted) * 100 : 0),
    threeAttemptedPerGame: round(totals.threeAttempted / safeGames),
    ftPct: round(totals.ftAttempted > 0 ? (totals.ftMade / totals.ftAttempted) * 100 : 0),
    ftAttemptedPerGame: round(totals.ftAttempted / safeGames),
    turnoversPerGame: round(totals.turnovers / safeGames),
    stealsPerGame: round(totals.steals / safeGames),
    blocksPerGame: round(totals.blocks / safeGames),
    foulsCommittedPerGame: round(totals.fouls / safeGames),
    foulsReceivedPerGame: 0,
    sourceUrl,
    seasonYearUsed: seasonYear,
    usedFallbackSeason,
    gamesSampled: games,
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as ImportPayload | null;
    const mode = payload?.mode || 'import';
    const playerName = payload?.playerName?.trim();
    const seasonYear = Number.isFinite(payload?.seasonYear)
      ? Number(payload?.seasonYear)
      : new Date().getFullYear() - 1;

    if (!playerName) {
      return NextResponse.json({ ok: false, error: 'Hiányzik a játékos neve.' }, { status: 400 });
    }

    const explicitProfileUrl = payload?.profileUrl ? normalizeProfileUrl(payload.profileUrl) : null;

    if (mode === 'search') {
      const searchResult = await searchPlayersByName(playerName);
      const maxCandidates = Number.isFinite(payload?.maxCandidates)
        ? Number(payload?.maxCandidates)
        : 12;
      const candidates = await enrichCandidatesWithPhotos(searchResult.candidates, maxCandidates);

      return NextResponse.json({
        ok: true,
        candidates,
        multiple: candidates.length > 1,
      });
    }

    let profileUrl = explicitProfileUrl;
    if (!profileUrl) {
      const searchResult = await searchPlayersByName(playerName);
      if (searchResult.candidates.length > 1) {
        const candidates = await enrichCandidatesWithPhotos(searchResult.candidates, 12);
        return NextResponse.json(
          {
            ok: false,
            error: 'Tobb azonos nev talalhato, valaszd ki a megfelelo jatekost.',
            code: 'MULTIPLE_MATCHES',
            candidates,
          },
          { status: 409 }
        );
      }

      profileUrl = searchResult.candidates[0]?.profileUrl;
    }

    if (!profileUrl) {
      throw new Error('Nem sikerult a jatekos profil URL feloldasa.');
    }

    const { html, resolvedUrl } = await fetchProfileHtml(profileUrl);
    const gameRows = extractGameRows(html);

    if (gameRows.length === 0) {
      throw new Error('Nem található publikus meccslog stat ezen a profilon. Lehet, hogy előfizetéses korlátozás miatt nem elérhető.');
    }

    const filteredRows = gameRows.filter(row => row.date.getFullYear() === seasonYear);
    const rowsToUse = filteredRows.length > 0 ? filteredRows : gameRows;
    const usedFallbackSeason = filteredRows.length === 0;

    const name = extractName(html, playerName);
    const position = extractPosition(html);
    const career = extractCareerContext(html);
    const result = buildImportResult(name, position, career, resolvedUrl, rowsToUse, seasonYear, usedFallbackSeason);

    return NextResponse.json({ ok: true, player: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt az Eurobasket import során.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
