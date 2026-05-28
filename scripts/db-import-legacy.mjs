import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(repoRoot, '.env.local');
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

function mapAccountType(rawType) {
  const value = String(rawType || '').toUpperCase();
  if (value === 'AHORROS' || value === 'SAVINGS') return 'SAVINGS';
  if (value === 'CORRIENTE' || value === 'CHECKING') return 'CHECKING';
  if (value === 'CREDITO' || value === 'TARJETA_CREDITO' || value === 'CREDIT_CARD') return 'CREDIT_CARD';
  if (value === 'EFECTIVO' || value === 'CASH') return 'CASH';
  if (value === 'INVERSION' || value === 'INVESTMENT') return 'INVESTMENT';
  if (value === 'LOAN') return 'LOAN';
  return 'OTHER';
}

function mapDirection(rawType, rawAmount) {
  const type = String(rawType || '').toUpperCase();
  if (type === 'INGRESO' || type === 'INFLOW') return 'INFLOW';
  if (type === 'GASTO' || type === 'EGRESO' || type === 'OUTFLOW') return 'OUTFLOW';
  return Number(rawAmount) < 0 ? 'OUTFLOW' : 'INFLOW';
}

function mapStatus(rawStatus) {
  const status = String(rawStatus || '').toUpperCase();
  if (status === 'PENDIENTE') return 'PENDING';
  if (status === 'CONCILIADO') return 'RECONCILED';
  if (status === 'ANULADO') return 'VOID';
  return 'POSTED';
}

loadEnvLocal();

const dryRun = process.argv.includes('--dry-run');
const DATABASE_URL = process.env.DATABASE_URL;
const LEGACY_DATABASE_URL = process.env.LEGACY_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found. Set it in environment or .env.local');
  process.exit(1);
}
if (!LEGACY_DATABASE_URL) {
  console.error('LEGACY_DATABASE_URL not found. Set it in environment or .env.local');
  process.exit(1);
}

const target = new Client({ connectionString: DATABASE_URL });
const legacy = new Client({ connectionString: LEGACY_DATABASE_URL });

try {
  await target.connect();
  await legacy.connect();

  const accounts = await legacy.query(
    'SELECT id, nombre, moneda, tipo, saldo_actual, cupo_maximo FROM cuentas ORDER BY id ASC'
  );
  const txs = await legacy.query(
    `SELECT id, descripcion, monto, tipo, estado, fecha_transaccion, cuenta_id, moneda
       FROM transacciones
      WHERE cuenta_id IS NOT NULL
        AND COALESCE(monto, 0) <> 0
      ORDER BY id ASC`
  );
  const holdings = await legacy.query(
    `SELECT id, simbolo, precio_entrada, estado, fecha_apertura
       FROM trades_activos
      WHERE COALESCE(tipo_estrategia, '') = 'HOLDING'
        AND precio_entrada IS NOT NULL
      ORDER BY id ASC`
  );

  console.log(`legacy cuentas: ${accounts.rowCount}`);
  console.log(`legacy transacciones: ${txs.rowCount}`);
  console.log(`legacy holdings: ${holdings.rowCount}`);

  if (dryRun) {
    console.log('dry-run enabled: no writes executed');
    process.exit(0);
  }

  await target.query('BEGIN');
  try {
    for (const acc of accounts.rows) {
      const accountType = mapAccountType(acc.tipo);
      const balanceCurrent =
        accountType === 'CREDIT_CARD' && acc.cupo_maximo != null && acc.saldo_actual != null
          ? Number(acc.cupo_maximo) - Number(acc.saldo_actual)
          : Number(acc.saldo_actual || 0);

      await target.query(
        `INSERT INTO accounts (code, name, currency, account_type, balance_current, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
         ON CONFLICT (code) DO NOTHING`,
        [
          `LEGACY-${acc.id}`,
          String(acc.nombre || `Cuenta ${acc.id}`).trim(),
          String(acc.moneda || 'COP').trim() || 'COP',
          accountType,
          Number.isFinite(balanceCurrent) ? balanceCurrent : 0,
        ]
      );
    }

    for (const tx of txs.rows) {
      const account = await target.query('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [`LEGACY-${tx.cuenta_id}`]);
      if (!account.rowCount) continue;

      await target.query(
        `INSERT INTO transactions (
           transaction_date,
           description,
           amount,
           currency,
           direction,
           status,
           account_id,
           external_ref,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (external_ref) DO NOTHING`,
        [
          tx.fecha_transaccion ? new Date(tx.fecha_transaccion).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          String(tx.descripcion || 'Sin descripcion').trim(),
          Math.abs(Number(tx.monto || 0)),
          String(tx.moneda || 'COP').trim() || 'COP',
          mapDirection(tx.tipo, tx.monto),
          mapStatus(tx.estado),
          Number(account.rows[0].id),
          `legacy:transacciones:${tx.id}`,
        ]
      );
    }

    for (const h of holdings.rows) {
      await target.query(
        `INSERT INTO investments (
           symbol,
           name,
           asset_type,
           quantity,
           avg_cost,
           currency,
           legacy_ref,
           notes,
           is_active,
           created_at,
           updated_at
         )
         VALUES ($1, $2, 'CRYPTO', 1, $3, 'USD', $4, 'Imported from legacy HOLDING', $5, COALESCE($6, NOW()), NOW())
         ON CONFLICT (legacy_ref) DO NOTHING`,
        [
          String(h.simbolo || 'UNKNOWN').trim() || 'UNKNOWN',
          String(h.simbolo || 'Legacy position').trim() || 'Legacy position',
          Number(h.precio_entrada || 0),
          `legacy:holding:${h.id}`,
          String(h.estado || 'OPEN').toUpperCase() === 'OPEN',
          h.fecha_apertura,
        ]
      );
    }

    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }

  const targetCounts = await target.query(
    `SELECT
       (SELECT COUNT(*)::int FROM accounts) AS accounts,
       (SELECT COUNT(*)::int FROM transactions) AS transactions,
       (SELECT COUNT(*)::int FROM investments) AS investments`
  );

  console.log('import completed:', targetCounts.rows[0]);
} catch (error) {
  console.error('import error:', error?.message || error);
  process.exit(1);
} finally {
  await target.end().catch(() => {});
  await legacy.end().catch(() => {});
}
