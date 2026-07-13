CREATE TABLE IF NOT EXISTS budget_funding_accounts (
  budget_id BIGINT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (budget_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_funding_accounts_account_id ON budget_funding_accounts(account_id);

CREATE TABLE IF NOT EXISTS budget_deficit_events (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  budget_line_id BIGINT REFERENCES budget_lines(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL CHECK (
    event_type IN ('ENTERED_DEFICIT', 'DEFICIT_WORSENED', 'DEFICIT_IMPROVED', 'EXITED_DEFICIT')
  ),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_month VARCHAR(7) NOT NULL,
  deficit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  funding_shortfall_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  budget_remaining_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  funding_remaining_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  cause_code VARCHAR(60) NOT NULL,
  cause_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_budget_deficit_events_budget_period
  ON budget_deficit_events(budget_id, period_month, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_deficit_events_period
  ON budget_deficit_events(period_month, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_deficit_events_event_type
  ON budget_deficit_events(event_type);
