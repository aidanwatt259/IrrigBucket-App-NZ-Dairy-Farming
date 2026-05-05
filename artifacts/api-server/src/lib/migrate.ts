import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  logger.info("Running database migrations...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR PRIMARY KEY,
      sess JSONB NOT NULL,
      expire TIMESTAMP NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR,
      first_name VARCHAR,
      last_name VARCHAR,
      profile_image_url VARCHAR,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Dynamically find and drop any unique constraint on the email column.
  // Supabase Auth enforces email uniqueness at the provider level so we
  // don't need it here, and it blocks upserts when a Supabase UUID differs
  // from an old Replit OIDC user-id for the same email address.
  await db.execute(sql`
    DO $$
    DECLARE
      c text;
    BEGIN
      SELECT tc.constraint_name INTO c
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema    = ccu.table_schema
      WHERE tc.table_name    = 'users'
        AND ccu.column_name  = 'email'
        AND tc.constraint_type = 'UNIQUE';
      IF c IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(c);
      END IF;
    END $$
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR REFERENCES users(id),
      irrigator_type VARCHAR,
      farm_name VARCHAR,
      assessor_name VARCHAR,
      test_date VARCHAR,
      report_data JSONB NOT NULL,
      du_percent VARCHAR,
      du_status VARCHAR,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS help_requests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR REFERENCES users(id),
      description TEXT NOT NULL,
      contact_info VARCHAR,
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  logger.info("Database migrations complete");
}
