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

-- Policies: Users can read all users, but only insert/update their own
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Policies: Discoveries - everyone can read, users can insert their own
CREATE POLICY "Anyone can read discoveries" ON discoveries FOR SELECT USING (true);
CREATE POLICY "Users can insert own discoveries" ON discoveries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to get leaderboard data
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
  WITH all_discoveries AS (
    SELECT * FROM discoveries
  ),
  total_scores AS (
    SELECT student, SUM(points)::BIGINT AS total_points
    FROM all_discoveries
    GROUP BY student
  ),
  weekly_scores AS (
    SELECT student, SUM(points)::BIGINT AS weekly_points
    FROM all_discoveries
    WHERE found_at >= one_week_ago
    GROUP BY student
  ),
  daily_activity AS (
    SELECT
      student,
      TO_CHAR(found_at AT TIME ZONE 'Asia/Singapore', 'Day') AS day_name,
      COUNT(*)::INTEGER AS count
    FROM all_discoveries
    WHERE found_at >= one_week_ago
    GROUP BY student, TO_CHAR(found_at AT TIME ZONE 'Asia/Singapore', 'Day')
  ),
  activity_json AS (
    SELECT
      student,
      JSONB_OBJECT_AGG(day_name, count) AS activity
    FROM daily_activity
    GROUP BY student
  )
  SELECT
    ts.student,
    ts.total_points,
    COALESCE(ws.weekly_points, 0) AS weekly_points,
    COALESCE(aj.activity, '{}'::JSONB) AS activity
  FROM total_scores ts
  LEFT JOIN weekly_scores ws ON ts.student = ws.student
  LEFT JOIN activity_json aj ON ts.student = aj.student
  ORDER BY ts.total_points DESC
  LIMIT 10;
END;
$$;

-- Function to get user stats
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
  WITH user_discoveries AS (
    SELECT * FROM discoveries WHERE user_id = p_user_id
  ),
  all_totals AS (
    SELECT student, SUM(points)::BIGINT AS total_points
    FROM discoveries
    GROUP BY student
  ),
  ranked AS (
    SELECT student, total_points, ROW_NUMBER() OVER (ORDER BY total_points DESC) AS rnk
    FROM all_totals
  ),
  user_rank AS (
    SELECT rnk FROM ranked WHERE student = (SELECT display_name FROM users WHERE id = p_user_id)
  ),
  weekly AS (
    SELECT SUM(points)::BIGINT AS weekly_points
    FROM user_discoveries
    WHERE found_at >= one_week_ago
  ),
  unique_count AS (
    SELECT COUNT(DISTINCT scientific_name) AS unique_species
    FROM user_discoveries
  )
  SELECT
    (SELECT total_points FROM all_totals WHERE student = (SELECT display_name FROM users WHERE id = p_user_id))::BIGINT,
    COALESCE((SELECT weekly_points FROM weekly), 0)::BIGINT,
    COALESCE((SELECT rnk FROM user_rank), 0)::INTEGER,
    (SELECT unique_species FROM unique_count)::INTEGER;
END;
$$;

-- Function to check daily limits
CREATE OR REPLACE FUNCTION check_daily_limits(p_user_id UUID, p_points INTEGER)
RETURNS TABLE (allowed BOOLEAN, message TEXT) LANGUAGE plpgsql AS $$
DECLARE
  start_of_day TIMESTAMPTZ := DATE_TRUNC('day', NOW()) AT TIME ZONE 'Asia/Singapore';
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
GRANT EXECUTE ON FUNCTION get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_daily_limits(UUID, INTEGER) TO authenticated;