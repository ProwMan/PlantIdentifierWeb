-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  display_name TEXT GENERATED ALWAYS AS (full_name || ' (' || class_name || ')') STORED,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discoveries table
CREATE TABLE IF NOT EXISTS discoveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  common_name TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points IN (1, 10)),
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  found_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_discoveries_user_id ON discoveries(user_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_found_at ON discoveries(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_discoveries_scientific_name ON discoveries(scientific_name);
CREATE INDEX IF NOT EXISTS idx_users_class_name ON users(class_name);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE discoveries ENABLE ROW LEVEL SECURITY;

-- Everyone holding the anon key may READ: the leaderboard lists every student, and the
-- Collection page reads the signed-in student's own discoveries.
--
-- Writes deliberately have NO policy here. This app authenticates with its own
-- name + class scheme instead of Supabase Auth, so `auth.uid()` is always NULL for the
-- browser and a policy such as `auth.uid() = user_id` can never be satisfied — a
-- client-side insert would always fail. All writes go through the server functions in
-- src/lib/api/identify.functions.ts, which use the service role (it bypasses RLS).
-- Adding an INSERT/UPDATE policy would therefore not enable anything real, it would only
-- widen access, so RLS stays default-deny for writes.
DROP POLICY IF EXISTS "Users can read all users" ON users;
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read discoveries" ON discoveries;
CREATE POLICY "Anyone can read discoveries" ON discoveries FOR SELECT USING (true);

-- Function to get leaderboard data
--
-- PL/pgSQL resolves a bare name that matches BOTH a RETURNS TABLE output parameter and a
-- column in the query as ambiguous and aborts the whole call:
--   ERROR: column reference "student" is ambiguous
-- The browser swallowed that error, so the leaderboard was always empty. Every column below
-- is therefore table-qualified and every CTE column is aliased away from an output name.
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
  -- Totals are grouped by user_id, not by the `student` text. discoveries.student is a
  -- denormalised label that older rows stored as the plain name while users.display_name
  -- appends the class ("Ada Lovelace" vs "Ada Lovelace (1.01)"), so joining on the text
  -- left every one of those students showing 0 points. user_id is the stable key.
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

-- Function to get user stats
-- Function to get user stats
--
-- Same PL/pgSQL name-resolution trap as get_leaderboard: `total_points`, `weekly_points`,
-- `rank` and `unique_species` are output parameters here, so a bare reference to a CTE
-- column with one of those names is ambiguous and the call fails with
--   ERROR: column reference "total_points" is ambiguous
-- The browser swallowed that error too, which is why every student saw 0 points forever.
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
  -- Keyed on user_id for the same reason as get_leaderboard: the denormalised
  -- discoveries.student text does not always equal users.display_name, and matching on it
  -- made real totals read as 0.
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

-- Function to check daily limits
--
-- The old expression, DATE_TRUNC('day', NOW()) AT TIME ZONE 'Asia/Singapore', truncated in
-- UTC and then re-read the result as Singapore wall time, so the "day" started at 16:00 SGT
-- instead of midnight. Truncating the Singapore wall clock first and then converting back to
-- a timestamptz gives midnight SGT.
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
    END IF;
  ELSE
    SELECT COUNT(*) INTO today_rediscoveries
    FROM discoveries
    WHERE user_id = p_user_id AND points = 1 AND found_at >= start_of_day;

    IF today_rediscoveries >= 10 THEN
      RETURN QUERY SELECT FALSE, 'You have reached the maximum limit of 10 rediscoveries for today. Come back tomorrow!';
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, '';
END;
$$;

-- Grant execute permissions
-- The browser talks to Supabase with the anon key, so it needs EXECUTE on the read
-- functions. Postgres grants EXECUTE to PUBLIC by default, but state it explicitly so
-- this script does not depend on that.
GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_daily_limits(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_daily_limits(UUID, INTEGER) TO service_role;

-- Table privileges. Supabase's default privileges normally cover these for the public
-- schema; stated explicitly so the script is self-contained and re-runnable. RLS still
-- applies to anon/authenticated (they are not the table owner), so these grants expose
-- only what the SELECT policies above allow.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON users, discoveries TO anon, authenticated;
GRANT ALL ON users, discoveries TO service_role;