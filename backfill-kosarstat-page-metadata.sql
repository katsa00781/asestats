-- Backfill structured metadata fields on already imported Kosarstat raw pages.
-- Safe to run repeatedly.

WITH extracted AS (
  SELECT
    id,
    NULLIF(TRIM((regexp_match(raw_text, '([0-9]{4}\s*[-/]\s*[0-9]{4})\s*\|'))[1]), '') AS season_label,
    NULLIF(TRIM((regexp_match(raw_text, '[0-9]{4}\s*[-/]\s*[0-9]{4}\s*\|\s*([^|]+)\s*\|'))[1]), '') AS phase_label,
    (regexp_match(raw_text, '\|\s*([0-9]{4})\.([0-9]{2})\.([0-9]{2})\.?\s*\|')) AS date_parts,
    (regexp_match(raw_text, E'\n\s*([^\n\d][^\n]*?)\s+-\s+([^\n\d][^\n]*?)\s*\n\s*\d{1,3}\s+-\s+\d{1,3}')) AS team_parts,
    (regexp_match(raw_text, E'\n\s*(\d{1,3})\s+-\s*(\d{1,3})\s*\n\s*[0-9]{4}\s*[-/]\s*[0-9]{4}')) AS score_parts
  FROM kosarstat_game_pages_raw
)
UPDATE kosarstat_game_pages_raw r
SET
  competition_season_label = COALESCE(r.competition_season_label, REPLACE(extracted.season_label, ' ', '')),
  competition_phase = COALESCE(r.competition_phase, extracted.phase_label),
  match_date = COALESCE(
    r.match_date,
    CASE
      WHEN extracted.date_parts IS NOT NULL
      THEN make_date(extracted.date_parts[1]::int, extracted.date_parts[2]::int, extracted.date_parts[3]::int)
      ELSE NULL
    END
  ),
  home_team_name = COALESCE(
    r.home_team_name,
    CASE WHEN extracted.team_parts IS NOT NULL THEN NULLIF(TRIM(extracted.team_parts[1]), '') ELSE NULL END
  ),
  away_team_name = COALESCE(
    r.away_team_name,
    CASE WHEN extracted.team_parts IS NOT NULL THEN NULLIF(TRIM(extracted.team_parts[2]), '') ELSE NULL END
  ),
  home_score = COALESCE(
    r.home_score,
    CASE WHEN extracted.score_parts IS NOT NULL THEN extracted.score_parts[1]::int ELSE NULL END
  ),
  away_score = COALESCE(
    r.away_score,
    CASE WHEN extracted.score_parts IS NOT NULL THEN extracted.score_parts[2]::int ELSE NULL END
  ),
  updated_at = NOW()
FROM extracted
WHERE r.id = extracted.id
  AND (
    r.competition_season_label IS NULL
    OR r.competition_phase IS NULL
    OR r.match_date IS NULL
    OR r.home_team_name IS NULL
    OR r.away_team_name IS NULL
    OR r.home_score IS NULL
    OR r.away_score IS NULL
  );

-- Quick verification:
-- SELECT page_type, COUNT(*) AS rows, COUNT(*) FILTER (WHERE match_date IS NOT NULL) AS with_date
-- FROM kosarstat_game_pages_raw
-- GROUP BY page_type
-- ORDER BY page_type;
