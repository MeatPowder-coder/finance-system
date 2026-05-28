-- Finance System core schema

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  account_type VARCHAR(30) NOT NULL CHECK (
    account_type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'INVESTMENT', 'LOAN', 'OTHER')
  ),
  balance_current NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW', 'BOTH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  status VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'RECONCILED', 'VOID')),
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  external_ref VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('MONTHLY', 'YEARLY')),
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  limit_amount NUMERIC(18,2) NOT NULL CHECK (limit_amount >= 0)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  cadence VARCHAR(20) NOT NULL CHECK (cadence IN ('WEEKLY', 'MONTHLY', 'YEARLY')),
  next_run_at DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, transaction_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_ref_unique
  ON transactions(external_ref)
  WHERE external_ref IS NOT NULL;
