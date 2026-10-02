import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPool } from './index.js';

export async function migrate(connectionString: string, sqlPath = fileURLToPath(new URL('../../../infra/migrations/0001_foundation.sql', import.meta.url))) {
  const pool = createPool(connectionString);
  const client = await pool.connect();
  try {
    const sql = await readFile(sqlPath, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73420001)');
    await client.query('SET LOCAL ROLE jarvis_owner');
    await client.query('CREATE SCHEMA IF NOT EXISTS jarvis AUTHORIZATION jarvis_owner');
    await client.query('CREATE TABLE IF NOT EXISTS jarvis.schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query('SELECT checksum FROM jarvis.schema_migrations WHERE version = 1');
    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) throw new Error('MIGRATION_CHECKSUM_CHANGED');
    } else {
      await client.query(sql);
      await client.query('INSERT INTO jarvis.schema_migrations(version, checksum) VALUES (1, $1)', [checksum]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!['development', 'foundation'].includes(process.env.APP_MODE ?? '') || !process.env.MIGRATION_DATABASE_URL) {
    console.error('Migration requires explicit development mode and MIGRATION_DATABASE_URL'); process.exitCode = 1;
  } else {
    try { await migrate(process.env.MIGRATION_DATABASE_URL); console.log('Migration 1 applied or already current'); }
    catch { console.error('Migration failed; inspect configuration/schema without logging credentials'); process.exitCode = 1; }
  }
}
