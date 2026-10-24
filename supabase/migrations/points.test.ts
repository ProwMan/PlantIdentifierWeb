// Runs the actual migration files against a real Postgres engine (PGlite, Postgres compiled
// to WASM), so the point functions are tested the way the database executes them — PL/pgSQL
// name resolution, timezone behaviour and all.
//
// This is the regression test for the two bugs that made the point system look broken:
//   1. ambiguous references inside RETURNS TABLE functions aborted every call;
//   2. totals were matched on the denormalised `student` text, which does not always equal
//      users.display_name, so real totals read as 0.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationsDir = dirname(fileURLToPath(import.meta.url));

// Supabase provides these roles and the uuid-ossp extension; PGlite does not, so stand them
// in. gen_random_uuid() is built into modern Postgres and does the same job.
const SUPABASE_SHIM = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
`;

const MIGRATIONS = [
  "001_initial_schema.sql",
  "002_fix_point_functions.sql",
  "003_points_by_user_id.sql",
];

const ADA = "11111111-1111-4111-8111-111111111111";
const ALAN = "22222222-2222-4222-8222-222222222222";
const GRACE = "33333333-3333-4333-8333-333333333333";

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`SET TIME ZONE 'UTC';${SUPABASE_SHIM}`);

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(migrationsDir, file), "utf8").replace(
      /CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/i,
      "",
    );
    await db.exec(sql);
  }

  return db;
}

async function seedStudents(db: PGlite) {
  await db.exec(`
    INSERT INTO users (id, full_name, class_name) VALUES
      ('${ADA}', 'Ada Lovelace', '1.01'),
      ('${ALAN}', 'Alan Turing', '1.02'),
      ('${GRACE}', 'Grace Hopper', '2.05');

    -- Ada's first row uses the legacy label (name only, no class); her second uses the
    -- current display_name. Both belong to the same student and must count together.
    INSERT INTO discoveries (user_id, student, scientific_name, common_name, points, confidence, found_at) VALUES
      ('${ADA}',   'Ada Lovelace',          'Ficus benjamina',   'Weeping fig',         10, 0.9, NOW()),
      ('${ADA}',   'Ada Lovelace (1.01)',   'Ficus benjamina',   'Weeping fig',          1, 0.8, NOW()),
      ('${ALAN}',  'Alan Turing',           'Monstera deliciosa','Swiss cheese plant',  10, 0.9, NOW()),
      ('${ALAN}',  'Alan Turing',           'Epipremnum aureum', 'Golden pothos',       10, 0.9, NOW());
  `);
}

let db: PGlite;

beforeEach(async () => {
  db = await createDatabase();
});

afterEach(async () => {
  await db.close();
});

describe("point functions", () => {
  it("returns real totals even when discoveries.student omits the class", async () => {
    await seedStudents(db);

    const { rows } = await db.query<{
      total_points: number;
      weekly_points: number;
      rank: number;
      unique_species: number;
    }>("SELECT * FROM get_user_stats($1)", [ADA]);

    expect(rows[0]).toEqual({
      total_points: 11,
      weekly_points: 11,
      rank: 2,
      unique_species: 1,
    });
  });

  it("returns a real rank for the leader and zeros for a student with no discoveries", async () => {
    await seedStudents(db);

    const leader = await db.query<{ total_points: number; rank: number }>(
      "SELECT * FROM get_user_stats($1)",
      [ALAN],
    );
    expect(leader.rows[0]).toMatchObject({ total_points: 20, rank: 1 });

    const empty = await db.query("SELECT * FROM get_user_stats($1)", [GRACE]);
    expect(empty.rows[0]).toEqual({
      total_points: 0,
      weekly_points: 0,
      rank: 0,
      unique_species: 0,
    });
  });

  it("lists one leaderboard row per student, with the class-qualified name", async () => {
    await seedStudents(db);

    const { rows } = await db.query<{
      student: string;
      total_points: number;
      weekly_points: number;
    }>("SELECT * FROM get_leaderboard()");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      student: "Alan Turing (1.02)",
      total_points: 20,
      weekly_points: 20,
    });
    expect(rows[1]).toMatchObject({
      student: "Ada Lovelace (1.01)",
      total_points: 11,
    });
  });

  it("starts the daily limit window at midnight Singapore time", async () => {
    const { rows } = await db.query<{ day_start: string }>(`
      SELECT to_char(
        (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore')
          AT TIME ZONE 'Asia/Singapore',
        'HH24:MI'
      ) AS day_start
    `);

    // The old expression truncated in UTC and re-read the result as Singapore time, which
    // put the boundary at 16:00.
    expect(rows[0].day_start).toBe("00:00");
  });

  it("counts only today's discoveries against the 10-a-day cap", async () => {
    await db.query("INSERT INTO users (id, full_name, class_name) VALUES ($1,'Ada','1.01')", [ADA]);

    // 10 new discoveries logged at 23:30 last night must not consume today's allowance.
    await db.query(`
      INSERT INTO discoveries (user_id, student, scientific_name, common_name, points, confidence, found_at)
      SELECT '${ADA}', 'Ada Lovelace', 'Yesterday species ' || n, 'x', 10, 0.9,
             (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore')
               - INTERVAL '30 minutes'
      FROM generate_series(1, 10) AS n
    `);

    const before = await db.query<{ allowed: boolean }>(
      "SELECT * FROM check_daily_limits($1, 10)",
      [ADA],
    );
    expect(before.rows[0].allowed).toBe(true);

    // Now ten new discoveries today: the cap applies.
    await db.query(`
      INSERT INTO discoveries (user_id, student, scientific_name, common_name, points, confidence, found_at)
      SELECT '${ADA}', 'Ada Lovelace', 'Today species ' || n, 'x', 10, 0.9, NOW()
      FROM generate_series(1, 10) AS n
    `);

    const after = await db.query<{ allowed: boolean; message: string | null }>(
      "SELECT * FROM check_daily_limits($1, 10)",
      [ADA],
    );
    expect(after.rows[0].allowed).toBe(false);
    expect(after.rows[0].message).toContain("10 new discoveries");
  });

  it("caps rediscoveries separately from new discoveries", async () => {
    await db.query("INSERT INTO users (id, full_name, class_name) VALUES ($1,'Ada','1.01')", [ADA]);
    await db.query(`
      INSERT INTO discoveries (user_id, student, scientific_name, common_name, points, confidence, found_at)
      SELECT '${ADA}', 'Ada Lovelace', 'Species ' || n, 'x', 1, 0.9, NOW()
      FROM generate_series(1, 10) AS n
    `);

    const rediscovery = await db.query<{ allowed: boolean }>(
      "SELECT * FROM check_daily_limits($1, 1)",
      [ADA],
    );
    expect(rediscovery.rows[0].allowed).toBe(false);

    // Rediscoveries must not eat into the new-discovery allowance.
    const newDiscovery = await db.query<{ allowed: boolean }>(
      "SELECT * FROM check_daily_limits($1, 10)",
      [ADA],
    );
    expect(newDiscovery.rows[0].allowed).toBe(true);
  });

  it("can be re-applied without error or side effects", async () => {
    await seedStudents(db);

    const sql = readFileSync(join(migrationsDir, "003_points_by_user_id.sql"), "utf8");
    await db.exec(sql);
    await db.exec(sql);

    const { rows } = await db.query<{ total_points: number }>("SELECT * FROM get_user_stats($1)", [
      ADA,
    ]);
    expect(rows[0].total_points).toBe(11);
  });
});
