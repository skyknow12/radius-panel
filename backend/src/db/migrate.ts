import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env';
import { logger } from '../lib/logger';
import { pool } from './pool';

/** Arbitrary constant used for pg_advisory_lock so only one instance migrates at a time. */
const MIGRATION_LOCK_ID = 727_001;

/**
 * Minimal, dependable SQL migration runner.
 * Applies every `migrations/NNN_name.sql` file not yet recorded in
 * `schema_migrations`, each inside its own transaction.
 */
export async function runMigrations(): Promise<void> {
  const dir = config.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'migrations');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await fs.readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      logger.info({ migration: file }, 'Applying migration');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    logger.info({ total: files.length }, 'Database migrations up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}
