import pg from 'pg';
export const SCHEMA_VERSION = 1;
export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 2000, statement_timeout: 3000 });
}
export async function assertDatabaseReady(pool: pg.Pool) {
  const result = await pool.query(`SELECT version FROM jarvis.schema_migrations ORDER BY version DESC LIMIT 1`);
  if (result.rows[0]?.version !== SCHEMA_VERSION) throw new Error('SCHEMA_MISMATCH');
  const role = await pool.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
  if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) throw new Error('UNSAFE_DATABASE_ROLE');
  const owned = await pool.query(`SELECT 1 FROM pg_tables WHERE schemaname = 'jarvis' AND tableowner = current_user`);
  if (owned.rowCount) throw new Error('DATABASE_ROLE_OWNS_TABLES');
  const extension = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
  if (extension.rowCount !== 1) throw new Error('VECTOR_MISSING');
}
