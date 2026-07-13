-- Phase 1 core accounting extensions (finance-only)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS counterparties (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'OTHER' CHECK (type IN ('PERSON', 'BUSINESS', 'INTERNAL', 'OTHER')),
  email VARCHAR(200),
  phone VARCHAR(60),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_counterparties_name_unique ON counterparties (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_counterparties_active ON counterparties (is_active);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_unique ON tags (LOWER(name));

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_counterparty_date ON transactions(counterparty_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(category_id, transaction_date DESC);

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id);

CREATE TABLE IF NOT EXISTS transaction_splits (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  description TEXT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  counterparty_id BIGINT REFERENCES counterparties(id) ON DELETE SET NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_id ON transaction_splits(category_id);

CREATE TABLE IF NOT EXISTS attachments (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120),
  file_size BIGINT CHECK (file_size IS NULL OR file_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id);

DROP TRIGGER IF EXISTS trg_counterparties_touch_updated_at ON counterparties;
CREATE TRIGGER trg_counterparties_touch_updated_at
BEFORE UPDATE ON counterparties
FOR EACH ROW
EXECUTE FUNCTION finance_touch_updated_at();
