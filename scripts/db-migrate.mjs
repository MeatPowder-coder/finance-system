import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function loadEnvFile(filename) {
  const envPath = path.join(repoRoot, filename);
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env.vm');

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  const preferred = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL_HOST;
  if (preferred) return preferred;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'servidor-db') {
      parsed.hostname = '127.0.0.1';
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace('@servidor-db:', '@127.0.0.1:');
  }
}

const DATABASE_URL = resolveDatabaseUrl(process.env.DATABASE_URL);
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found. Set it in environment or .env.local');
  process.exit(1);
}

const migrationsDir = path.join(repoRoot, 'db', 'migrations');
const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => /^\d+_.*\.sql$/.test(name))
  // Raw legacy pg_dump file includes psql meta commands (\restrict/\unrestrict)
  // and owner statements that are not portable in automated Node migrations.
  // We keep and apply the compatible migration variant instead.
  .filter((name) => name !== '003_legacy_copilot_tables.sql')
  .sort((a, b) => a.localeCompare(b, 'en'));

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  async function markApplied(filename) {
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [filename]);
  }

  for (const filename of files) {
    const already = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1', [filename]);
    if (already.rowCount) {
      console.log(`skip ${filename}`);
      continue;
    }

    // Legacy compatible copilot dump can already be present via pg_restore/import.
    // If those tables exist, mark migration as applied to keep bootstrap idempotent.
    if (filename === '004_legacy_copilot_tables_compatible.sql') {
      const legacyTables = await client.query(
        `SELECT
           to_regclass('public.react_chat_sessions') IS NOT NULL AS has_sessions,
           to_regclass('public.react_chat_messages') IS NOT NULL AS has_messages,
           to_regclass('public.chat_history') IS NOT NULL AS has_history,
           to_regclass('public.chat_uploads') IS NOT NULL AS has_uploads`
      );
      const row = legacyTables.rows[0] || {};
      if (row.has_sessions && row.has_messages && row.has_history && row.has_uploads) {
        console.log(`skip ${filename} (legacy copilot tables already exist)`);
        await markApplied(filename);
        continue;
      }
    }

    if (filename === '009_auth_identity.sql') {
      const authTables = await client.query(
        `SELECT
           to_regclass('public.auth_users') IS NOT NULL AS has_auth_users,
           to_regclass('public.auth_sessions') IS NOT NULL AS has_auth_sessions`
      );
      const row = authTables.rows[0] || {};
      if (row.has_auth_users && row.has_auth_sessions) {
        console.log(`skip ${filename} (auth identity tables already exist)`);
        await markApplied(filename);
        continue;
      }
    }

    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`apply ${filename}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await markApplied(filename);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('migrations completed');
} catch (error) {
  console.error('migration error:', error?.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
