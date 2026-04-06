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
      email VARCHAR UNIQUE,
      first_name VARCHAR,
      last_name VARCHAR,
      profile_image_url VARCHAR,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
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
