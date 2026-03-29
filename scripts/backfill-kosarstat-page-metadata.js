require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const PAGE_TYPE_PRIORITY = {
  game: 100,
  game_playbyplay: 90,
  game_lineups: 80,
  game_qrts: 70,
  game_shots: 60
};

const pickBetter = (current, candidate, candidatePriority) => {
  if (candidate == null || candidate === '') return current;
  if (!current || current.value == null || current.value === '') {
    return { value: candidate, priority: candidatePriority };
  }
  if (candidatePriority > current.priority) {
    return { value: candidate, priority: candidatePriority };
  }
  return current;
};

const cleanTeamName = value => {
  if (!value) return null;
  const cleaned = String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s*\(Mérleg:.*$/i, '')
    .replace(/\s*\(.*vezetőedző.*$/i, '')
    .replace(/\s*\(.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
};

const TEAM_LINE_BLOCKLIST = [
  'mérkőzés végi',
  'clutch',
  'statisztik',
  'on-off',
  'eredmény',
  'alakulása',
  'esemény',
  'vissza az elejére',
  'adatvédelem'
];

const looksLikeTeamPair = (homeCandidate, awayCandidate, line) => {
  const lineLower = String(line || '').toLowerCase();
  if (TEAM_LINE_BLOCKLIST.some(token => lineLower.includes(token))) return false;

  const home = String(homeCandidate || '').trim();
  const away = String(awayCandidate || '').trim();
  if (!home || !away) return false;
  if (home.length < 3 || away.length < 3) return false;
  if (/^\d+$/.test(home) || /^\d+$/.test(away)) return false;
  if (!/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(home) || !/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(away)) return false;

  return true;
};

const parseMeta = raw => {
  const lines = String(raw || '')
    .split('\n')
    .map(x => x.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  let season = null;
  let phase = null;
  let date = null;
  let home = null;
  let away = null;
  let homeScore = null;
  let awayScore = null;

  for (const line of lines) {
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) continue;

    if (!season || !phase || !date) {
      const p = compact.split('|').map(x => x.trim()).filter(Boolean);
      if (p.length >= 3) {
        if (!season && /^\d{4}\s*[-/]\s*\d{4}$/.test(p[0])) {
          season = p[0].replace(/\s+/g, '');
        }
        if (!phase) phase = p[1] || null;
        if (!date) {
          const m = /(\d{4})\.(\d{2})\.(\d{2})/.exec(p[2]);
          if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
        }
      }
    }

    if (!season) {
      const seasonMatch = /(20\d{2})\s*[-/]\s*(20\d{2})/.exec(compact);
      if (seasonMatch) {
        season = `${seasonMatch[1]}/${seasonMatch[2]}`;
      }
    }

    if (!phase) {
      const phaseMatch = /(Alapszakasz|Rájátszás|Középszakasz|Play\s*-?\s*off|Playout)/i.exec(compact);
      if (phaseMatch) {
        phase = phaseMatch[1];
      }
    }

    if (!date) {
      const dateMatch = /(20\d{2})[./-](\d{2})[./-](\d{2})/.exec(compact);
      if (dateMatch) {
        date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
    }

    if ((!home || !away) && /\S\s*-\s*\S/.test(compact) && !/^(\d{1,3})\s*-\s*(\d{1,3})$/.test(compact)) {
      const m = /^(.+?)\s*-\s*(.+)$/.exec(compact);
      if (m) {
        const maybeHome = cleanTeamName(m[1]);
        const maybeAway = cleanTeamName(m[2]);
        if (looksLikeTeamPair(maybeHome, maybeAway, compact)) {
          if (!home) home = maybeHome;
          if (!away) away = maybeAway;
        }
      }
    }

    if (homeScore === null || awayScore === null) {
      const m = /^\D{0,4}(\d{1,3})\s*-\s*(\d{1,3})\D{0,4}$/.exec(compact);
      if (m) {
        homeScore = Number.parseInt(m[1], 10);
        awayScore = Number.parseInt(m[2], 10);
      }
    }

    if (season && phase && date && home && away && homeScore !== null && awayScore !== null) break;
  }

  return { season, phase, date, home, away, homeScore, awayScore };
};

const buildDonorMetaByGameId = rows => {
  const byGameId = new Map();

  for (const row of rows) {
    if (!row.kosarstat_game_id) continue;

    const parsed = parseMeta(row.raw_text);
    const priority = PAGE_TYPE_PRIORITY[row.page_type] || 10;

    const existing = byGameId.get(row.kosarstat_game_id) || {
      season: null,
      phase: null,
      date: null,
      home: null,
      away: null,
      homeScore: null,
      awayScore: null
    };

    existing.season = pickBetter(existing.season, row.competition_season_label ?? parsed.season, priority);
    existing.phase = pickBetter(existing.phase, row.competition_phase ?? parsed.phase, priority);
    existing.date = pickBetter(existing.date, row.match_date ?? parsed.date, priority);
    existing.home = pickBetter(existing.home, row.home_team_name ?? parsed.home, priority);
    existing.away = pickBetter(existing.away, row.away_team_name ?? parsed.away, priority);
    existing.homeScore = pickBetter(existing.homeScore, row.home_score ?? parsed.homeScore, priority);
    existing.awayScore = pickBetter(existing.awayScore, row.away_score ?? parsed.awayScore, priority);

    byGameId.set(row.kosarstat_game_id, existing);
  }

  return byGameId;
};

(async () => {
  const { data: seasonRow, error: seasonError } = await supabase
    .from('seasons')
    .select('id,name')
    .eq('name', '2025/2026')
    .maybeSingle();

  if (seasonError || !seasonRow?.id) {
    console.error('Season lookup failed', seasonError || 'not found');
    process.exit(1);
  }

  const { data: allRows, error: loadError } = await supabase
    .from('kosarstat_game_pages_raw')
    .select('id, kosarstat_game_id, page_type, raw_text, competition_season_label, competition_phase, match_date, home_team_name, away_team_name, home_score, away_score')
    .eq('season_id', seasonRow.id)
    .order('imported_at', { ascending: false });

  if (loadError || !Array.isArray(allRows)) {
    console.error('Load failed', loadError || 'invalid rows');
    process.exit(1);
  }

  const rows = allRows.filter(r => r.page_type === 'game');
  const donorMetaByGameId = buildDonorMetaByGameId(allRows);

  let scanned = 0;
  let hadMissing = 0;
  let updated = 0;
  let skippedNoExtract = 0;
  let failed = 0;

  for (const r of rows) {
    scanned += 1;
    const missingAny =
      !r.competition_season_label ||
      !r.competition_phase ||
      !r.match_date ||
      !r.home_team_name ||
      !r.away_team_name ||
      r.home_score === null ||
      r.away_score === null;

    if (!missingAny) continue;
    hadMissing += 1;

    const parsed = parseMeta(r.raw_text);
    const donorMeta = donorMetaByGameId.get(r.kosarstat_game_id);
    const patch = {};

    const seasonValue = parsed.season || donorMeta?.season?.value || seasonRow.name;
    const phaseValue = parsed.phase || donorMeta?.phase?.value;
    let dateValue = parsed.date || donorMeta?.date?.value;
    if (!dateValue && /^\d{8,}/.test(String(r.kosarstat_game_id || ''))) {
      const digits = String(r.kosarstat_game_id).slice(0, 8);
      dateValue = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    const homeValue = parsed.home || donorMeta?.home?.value;
    const awayValue = parsed.away || donorMeta?.away?.value;
    const homeScoreValue = Number.isFinite(parsed.homeScore) ? parsed.homeScore : donorMeta?.homeScore?.value;
    const awayScoreValue = Number.isFinite(parsed.awayScore) ? parsed.awayScore : donorMeta?.awayScore?.value;

    if (!r.competition_season_label && seasonValue) patch.competition_season_label = seasonValue;
    if (!r.competition_phase && phaseValue) patch.competition_phase = phaseValue;
    if (!r.match_date && dateValue) patch.match_date = dateValue;
    if (!r.home_team_name && homeValue) patch.home_team_name = homeValue;
    if (!r.away_team_name && awayValue) patch.away_team_name = awayValue;
    if (r.home_score === null && Number.isFinite(homeScoreValue)) patch.home_score = homeScoreValue;
    if (r.away_score === null && Number.isFinite(awayScoreValue)) patch.away_score = awayScoreValue;

    if (Object.keys(patch).length === 0) {
      skippedNoExtract += 1;
      continue;
    }

    patch.updated_at = new Date().toISOString();

    const { error: upError } = await supabase
      .from('kosarstat_game_pages_raw')
      .update(patch)
      .eq('id', r.id);

    if (upError) {
      failed += 1;
      continue;
    }

    updated += 1;
  }

  const { data: after, error: afterError } = await supabase
    .from('kosarstat_game_pages_raw')
    .select('id, match_date, home_team_name, away_team_name, home_score, away_score, competition_phase, competition_season_label')
    .eq('season_id', seasonRow.id)
    .eq('page_type', 'game');

  if (afterError || !Array.isArray(after)) {
    console.error('Post-check failed', afterError || 'invalid after rows');
    process.exit(1);
  }

  const total = after.length;
  const withDate = after.filter(x => !!x.match_date).length;
  const withTeams = after.filter(x => !!x.home_team_name && !!x.away_team_name).length;
  const withScores = after.filter(x => Number.isFinite(x.home_score) && Number.isFinite(x.away_score)).length;
  const withSeason = after.filter(x => !!x.competition_season_label).length;
  const withPhase = after.filter(x => !!x.competition_phase).length;

  console.log(JSON.stringify({
    season: seasonRow.name,
    scanned,
    hadMissing,
    updated,
    skippedNoExtract,
    failed,
    coverage: { total, withDate, withTeams, withScores, withSeason, withPhase }
  }, null, 2));
})();
