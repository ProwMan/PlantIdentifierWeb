-- 003_points_by_user_id.sql
--
-- Run this in the Supabase SQL Editor on the live database. It is re-runnable: every
-- statement is CREATE OR REPLACE / GRANT, and no data is touched.
--
-- Why it is needed:
--
-- get_user_stats and get_leaderboard used to match a student's rows through the
-- denormalised `discoveries.student` text. That text is not always what
-- `users.display_name` holds: rows written by older builds stored only the name
-- ("Ada Lovelace") while display_name appends the class ("Ada Lovelace (1.01)").
-- The lookup therefore found nothing and returned:
--
--   total_points = 0, weekly_points = 0, rank = 0   (even with 11 points on record)
--
-- while the leaderboard grouped the same rows under the class-less string. Points were
-- being stored correctly the whole time; only the read was wrong.
--
-- Both functions now group and look up by `discoveries.user_id`, the stable key, and take
-- the display name from `users` (falling back to the stored label if a row is orphaned).
-- Function signatures are unchanged, so the client needs no other change.

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_points BIGINT,
  weekly_points BIGINT,
  rank INTEGER,
  unique_species INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  one_week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  WITH totals AS (
    SELECT d.user_id AS uid,
           MAX(COALESCE(u.display_name, d.student)) AS s_name,
           SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    LEFT JOIN users u ON u.id = d.user_id
    GROUP BY d.user_id
  ),
  ranked AS (
    SELECT t.uid, ROW_NUMBER() OVER (ORDER BY t.pts DESC, t.s_name) AS rnk
    FROM totals t
  )
  SELECT
    COALESCE((SELECT t.pts FROM totals t WHERE t.uid = p_user_id), 0)::BIGINT,
    COALESCE((SELECT SUM(d.points) FROM discoveries d
              WHERE d.user_id = p_user_id AND d.found_at >= one_week_ago), 0)::BIGINT,
    COALESCE((SELECT r.rnk FROM ranked r WHERE r.uid = p_user_id), 0)::INTEGER,
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
    SELECT d.user_id AS uid,
           MAX(COALESCE(u.display_name, d.student)) AS s_name,
           SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    LEFT JOIN users u ON u.id = d.user_id
    GROUP BY d.user_id
  ),
  weekly AS (
    SELECT d.user_id AS uid, SUM(d.points)::BIGINT AS pts
    FROM discoveries d
    WHERE d.found_at >= one_week_ago
    GROUP BY d.user_id
  ),
  daily AS (
    SELECT d.user_id AS uid,
           TO_CHAR(d.found_at AT TIME ZONE 'Asia/Singapore', 'Day') AS day_name,
           COUNT(*)::INTEGER AS n
    FROM discoveries d
    WHERE d.found_at >= one_week_ago
    GROUP BY d.user_id, TO_CHAR(d.found_at AT TIME ZONE 'Asia/Singapore', 'Day')
  ),
  activity AS (
    SELECT da.uid, JSONB_OBJECT_AGG(da.day_name, da.n) AS j
    FROM daily da
    GROUP BY da.uid
  )
  SELECT t.s_name, t.pts, COALESCE(w.pts, 0), COALESCE(a.j, '{}'::JSONB)
  FROM totals t
  LEFT JOIN weekly w ON w.uid = t.uid
  LEFT JOIN activity a ON a.uid = t.uid
  ORDER BY t.pts DESC, t.s_name ASC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon, authenticated;
