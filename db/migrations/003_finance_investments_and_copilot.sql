-- Investments + Copilot persistence

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(30) NOT NULL,
  name VARCHAR(160) NOT NULL,
  asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('STOCK', 'ETF', 'CRYPTO', 'BOND', 'FUND', 'OTHER')),
  quantity NUMERIC(24,8) NOT NULL CHECK (quantity >= 0),
  avg_cost NUMERIC(18,8) NOT NULL CHECK (avg_cost >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  legacy_ref VARCHAR(120) UNIQUE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copilot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'ACCOUNTANT' CHECK (mode IN ('ACCOUNTANT', 'ANALYST')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES copilot_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_symbol ON investments(symbol);
CREATE INDEX IF NOT EXISTS idx_investments_active ON investments(is_active);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_session_created ON copilot_messages(session_id, created_at);

DROP TRIGGER IF EXISTS trg_investments_touch_updated_at ON investments;
CREATE TRIGGER trg_investments_touch_updated_at
BEFORE UPDATE ON investments
FOR EACH ROW
EXECUTE FUNCTION finance_touch_updated_at();

DROP TRIGGER IF EXISTS trg_copilot_sessions_touch_updated_at ON copilot_sessions;
CREATE TRIGGER trg_copilot_sessions_touch_updated_at
BEFORE UPDATE ON copilot_sessions
FOR EACH ROW
EXECUTE FUNCTION finance_touch_updated_at();
