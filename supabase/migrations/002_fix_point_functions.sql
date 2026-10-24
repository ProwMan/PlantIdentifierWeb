-- 002_fix_point_functions.sql
--
-- Run this in the Supabase SQL Editor on a database that was created with
-- 001_initial_schema.sql BEFORE the point-system fix. Fresh databases created from the
-- current 001 already contain these definitions, so running it there is a harmless no-op
-- (every statement is CREATE OR REPLACE / GRANT).
--
-- Why it is needed:
--
-- 1. get_user_stats and get_leaderboard aborted at runtime with
--      ERROR: column reference "<name>" is ambiguous
--    PL/pgSQL treats a bare identifier that matches both a RETURNS TABLE output parameter
--    and a column in the query as ambiguous. Both functions hit that, so every call failed.
--    The app swallowed the error, so points rendered as 0 and the leaderboard was empty.
--
-- 2. check_daily_limits used DATE_TRUNC('day', NOW()) AT TIME ZONE 'Asia/Singapore', which
--    truncated in UTC and then re-read the result as Singapore wall time. The daily window
--    therefore began at 16:00 SGT instead of 00:00 SGT.
--
-- The function signatures are unchanged, so the client needs no other change.

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_points BIGINT,
  weekly_points BIGINT,
  rank INTEGER,
  unique_species INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  one_week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  me TEXT;
BEGIN
  SELECT u.display_name INTO me FROM users u WHERE u.id = p_user_id;

  RETURN QUERY
  WITH totals AS (
    SELECT d.student AS s_name, SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    GROUP BY d.student
  ),
  ranked AS (
    SELECT t.s_name, ROW_NUMBER() OVER (ORDER BY t.pts DESC) AS rnk
    FROM totals t
  )
  SELECT
    COALESCE((SELECT t.pts FROM totals t WHERE t.s_name = me), 0)::BIGINT,
    COALESCE((SELECT SUM(d.points) FROM discoveries d
              WHERE d.user_id = p_user_id AND d.found_at >= one_week_ago), 0)::BIGINT,
    COALESCE((SELECT r.rnk FROM ranked r WHERE r.s_name = me), 0)::INTEGER,
    (SELECT COUNT(DISTINCT d.scientific_name) FROM discoveries d WHERE d.user_id = p_user_id)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  student TEXT,
  total_points BIGINT,
  weekly_points BIGINT,
  activity JSONB
) LANGUAGE plpgsql AS $$
DECLARE
  one_week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  WITH totals AS (
    SELECT d.student AS s_name, SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    GROUP BY d.student
  ),
  weekly AS (
    SELECT d.student AS s_name, SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    WHERE d.found_at >= one_week_ago
    GROUP BY d.student
  ),
  daily AS (
    SELECT d.student AS s_name,
           TO_CHAR(d.found_at AT TIME ZONE 'Asia/Singapore', 'Day') AS day_name,
           COUNT(*)::INTEGER AS n
    FROM discoveries d
    WHERE d.found_at >= one_week_ago
    GROUP BY d.student, TO_CHAR(d.found_at AT TIME ZONE 'Asia/Singapore', 'Day')
  ),
  activity AS (
    SELECT da.s_name, JSONB_OBJECT_AGG(da.day_name, da.n) AS j
    FROM daily da
    GROUP BY da.s_name
  )
  SELECT t.s_name, t.pts, COALESCE(w.pts, 0), COALESCE(a.j, '{}'::JSONB)
  FROM totals t
  LEFT JOIN weekly w ON w.s_name = t.s_name
  LEFT JOIN activity a ON a.s_name = t.s_name
  ORDER BY t.pts DESC
  LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION check_daily_limits(p_user_id UUID, p_points INTEGER)
RETURNS TABLE (allowed BOOLEAN, message TEXT) LANGUAGE plpgsql AS $$
DECLARE
  start_of_day TIMESTAMPTZ := DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore';
  today_new_discoveries INTEGER;
  today_rediscoveries INTEGER;
BEGIN
  IF p_points = 10 THEN
    SELECT COUNT(*) INTO today_new_discoveries
    FROM discoveries
    WHERE user_id = p_user_id AND points = 10 AND found_at >= start_of_day;

    IF today_new_discoveries >= 10 THEN
      RETURN QUERY SELECT FALSE, 'You have reached the maximum limit of 10 new discoveries for today. Come back tomorrow!';
      RETURN;
    END IF;
  ELSE
    SELECT COUNT(*) INTO today_rediscoveries
    FROM discoveries
    WHERE user_id = p_user_id AND points = 1 AND found_at >= start_of_day;

    IF today_rediscoveries >= 10 THEN
      RETURN QUERY SELECT FALSE, 'You have reached the maximum limit of 10 rediscoveries for today. Come back tomorrow!';
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, '';
END;
$$;

GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_daily_limits(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_daily_limits(UUID, INTEGER) TO service_role;
