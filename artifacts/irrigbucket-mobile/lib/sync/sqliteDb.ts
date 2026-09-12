import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'irrigbucket.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Open (once) the durable expo-sqlite database and create the schema.
 *
 * Two tables back the offline-first store:
 *  - `reports`: the local mirror of every {@link SyncReport}; sync-relevant
 *    columns are denormalized for cheap queries while the full domain payload
 *    lives JSON-encoded in `report_data`.
 *  - `sync_queue`: the outbox, keyed one-row-per-report (`report_id UNIQUE`) so
 *    a newer enqueue coalesces the previous pending op.
 *
 * The singleton promise guarantees the schema is created exactly once and that
 * every caller shares the same connection.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      // WAL improves native read/write concurrency; it is not applicable on the
      // web (wa-sqlite) backend, so guard it to avoid a no-op/error there.
      if (Platform.OS !== 'web') {
        await db.execAsync('PRAGMA journal_mode = WAL;');
      }
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY NOT NULL,
          client_updated_at TEXT NOT NULL,
          deleted_at TEXT,
          irrigator_type TEXT,
          farm_name TEXT,
          assessor_name TEXT,
          test_date TEXT,
          du_percent TEXT,
          du_status TEXT,
          user_id TEXT,
          created_at TEXT,
          updated_at TEXT,
          synced_at TEXT,
          report_data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports (deleted_at);
        CREATE INDEX IF NOT EXISTS idx_reports_client_updated_at ON reports (client_updated_at);

        CREATE TABLE IF NOT EXISTS sync_queue (
          enqueue_id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL UNIQUE,
          op TEXT NOT NULL,
          op_client_updated_at TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT NOT NULL,
          enqueued_at TEXT NOT NULL,
          last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_report_id ON sync_queue (report_id);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_next_attempt_at ON sync_queue (next_attempt_at);
      `);
      return db;
    })();
  }
  return dbPromise;
}
