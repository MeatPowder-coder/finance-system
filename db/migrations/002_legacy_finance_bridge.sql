-- Bridge migration to import legacy finance data from trading-journal tables
-- This migration is safe to run multiple times.

CREATE OR REPLACE FUNCTION finance_map_account_type(raw_type TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE UPPER(COALESCE(raw_type, ''))
    WHEN 'AHORROS' THEN 'SAVINGS'
    WHEN 'SAVINGS' THEN 'SAVINGS'
    WHEN 'CORRIENTE' THEN 'CHECKING'
    WHEN 'CHECKING' THEN 'CHECKING'
    WHEN 'CREDITO' THEN 'CREDIT_CARD'
    WHEN 'TARJETA_CREDITO' THEN 'CREDIT_CARD'
    WHEN 'CASH' THEN 'CASH'
    WHEN 'EFECTIVO' THEN 'CASH'
    WHEN 'INVERSION' THEN 'INVESTMENT'
    WHEN 'INVESTMENT' THEN 'INVESTMENT'
    WHEN 'LOAN' THEN 'LOAN'
    ELSE 'OTHER'
  END;
$$;

CREATE OR REPLACE FUNCTION finance_map_direction(raw_type TEXT, raw_amount NUMERIC)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN UPPER(COALESCE(raw_type, '')) IN ('INGRESO', 'INFLOW') THEN 'INFLOW'
    WHEN UPPER(COALESCE(raw_type, '')) IN ('GASTO', 'EGRESO', 'OUTFLOW') THEN 'OUTFLOW'
    WHEN raw_amount < 0 THEN 'OUTFLOW'
    ELSE 'INFLOW'
  END;
$$;

CREATE OR REPLACE FUNCTION finance_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_touch_updated_at ON accounts;
CREATE TRIGGER trg_accounts_touch_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION finance_touch_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_touch_updated_at ON transactions;
CREATE TRIGGER trg_transactions_touch_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION finance_touch_updated_at();

INSERT INTO categories (code, name, direction)
VALUES
  ('SALARIO', 'Salario', 'INFLOW'),
  ('TRANSFERENCIA', 'Transferencia', 'BOTH'),
  ('MERCADO', 'Mercado', 'OUTFLOW'),
  ('SERVICIOS', 'Servicios', 'OUTFLOW'),
  ('SALUD', 'Salud', 'OUTFLOW'),
  ('TRANSPORTE', 'Transporte', 'OUTFLOW'),
  ('INVERSION', 'Inversion', 'BOTH'),
  ('OTROS', 'Otros', 'BOTH')
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.cuentas') IS NULL THEN
    RAISE NOTICE 'Legacy table public.cuentas not found. Skipping legacy accounts import.';
    RETURN;
  END IF;

  INSERT INTO accounts (
    code,
    name,
    currency,
    account_type,
    balance_current,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'LEGACY-' || c.id::TEXT,
    COALESCE(NULLIF(TRIM(c.nombre), ''), 'Cuenta ' || c.id::TEXT),
    COALESCE(NULLIF(TRIM(c.moneda), ''), 'COP'),
    finance_map_account_type(c.tipo),
    CASE
      WHEN finance_map_account_type(c.tipo) = 'CREDIT_CARD' AND c.cupo_maximo IS NOT NULL AND c.saldo_actual IS NOT NULL
        THEN (c.cupo_maximo - c.saldo_actual)
      ELSE COALESCE(c.saldo_actual, 0)
    END,
    TRUE,
    NOW(),
    NOW()
  FROM cuentas c
  ON CONFLICT (code) DO NOTHING;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.transacciones') IS NULL THEN
    RAISE NOTICE 'Legacy table public.transacciones not found. Skipping legacy transactions import.';
    RETURN;
  END IF;

  INSERT INTO transactions (
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
  SELECT
    COALESCE(t.fecha_transaccion::DATE, CURRENT_DATE),
    COALESCE(NULLIF(TRIM(t.descripcion), ''), 'Sin descripcion'),
    ABS(COALESCE(t.monto, 0)),
    COALESCE(NULLIF(TRIM(t.moneda), ''), 'COP'),
    finance_map_direction(t.tipo, t.monto),
    CASE UPPER(COALESCE(t.estado, ''))
      WHEN 'PENDIENTE' THEN 'PENDING'
      WHEN 'REALIZADO' THEN 'POSTED'
      WHEN 'CONCILIADO' THEN 'RECONCILED'
      WHEN 'ANULADO' THEN 'VOID'
      ELSE 'POSTED'
    END,
    a.id,
    'legacy:transacciones:' || t.id::TEXT,
    NOW(),
    NOW()
  FROM transacciones t
  JOIN accounts a
    ON a.code = 'LEGACY-' || t.cuenta_id::TEXT
  WHERE t.cuenta_id IS NOT NULL
    AND COALESCE(t.monto, 0) <> 0
  ON CONFLICT (external_ref) DO NOTHING;
END;
$$;
