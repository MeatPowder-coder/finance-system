-- Multi-tenant ownership for private finance data.
-- Each authenticated user gets an isolated row-level workspace.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE budget_funding_accounts
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE budget_deficit_events
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE recurring_rules
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE counterparties
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE transaction_tags
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE transaction_splits
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE copilot_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE copilot_messages
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_steps
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_tool_calls
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_proposals
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_approvals
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_memories
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_schedules
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE agent_reminders
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE generated_views
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE generated_view_widgets
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

ALTER TABLE projection_scenarios
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE;

DO $$
DECLARE
  primary_owner_id UUID;
BEGIN
  SELECT id
    INTO primary_owner_id
    FROM auth_users
   ORDER BY created_at ASC
   LIMIT 1;

  IF primary_owner_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE categories SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE accounts SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE transactions SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE budgets SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE budget_lines SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE budget_funding_accounts SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE budget_deficit_events SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE recurring_rules SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE investments SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE counterparties SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE tags SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE transaction_tags SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE transaction_splits SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE attachments SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE copilot_sessions SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE copilot_messages SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_runs SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_steps SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_tool_calls SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_proposals SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_approvals SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_memories SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_schedules SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE agent_reminders SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE generated_views SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE generated_view_widgets SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
  UPDATE projection_scenarios SET owner_user_id = primary_owner_id WHERE owner_user_id IS NULL;
END $$;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_code_key;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_key;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_legacy_ref_key;
ALTER TABLE generated_views DROP CONSTRAINT IF EXISTS generated_views_slug_key;
ALTER TABLE agent_memories DROP CONSTRAINT IF EXISTS agent_memories_scope_key_key;

DROP INDEX IF EXISTS idx_transactions_external_ref_unique;
DROP INDEX IF EXISTS idx_counterparties_name_unique;
DROP INDEX IF EXISTS idx_tags_name_unique;

CREATE INDEX IF NOT EXISTS idx_categories_owner_user_id ON categories(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_owner_code_unique ON categories(owner_user_id, code);
CREATE INDEX IF NOT EXISTS idx_categories_owner_name_unique ON categories(owner_user_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id ON accounts(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_owner_code_unique ON accounts(owner_user_id, code);

CREATE INDEX IF NOT EXISTS idx_transactions_owner_user_id ON transactions(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_owner_external_ref_unique
  ON transactions(owner_user_id, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_owner_user_id ON budgets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_owner_user_id ON budget_lines(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_funding_accounts_owner_user_id ON budget_funding_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_deficit_events_owner_user_id ON budget_deficit_events(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_owner_user_id ON recurring_rules(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_investments_owner_user_id ON investments(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investments_owner_legacy_ref_unique
  ON investments(owner_user_id, legacy_ref)
  WHERE legacy_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_counterparties_owner_user_id ON counterparties(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_counterparties_owner_name_unique ON counterparties(owner_user_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_tags_owner_user_id ON tags(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_owner_name_unique ON tags(owner_user_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_transaction_tags_owner_user_id ON transaction_tags(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_owner_user_id ON transaction_splits(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_owner_user_id ON attachments(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_owner_user_id ON copilot_sessions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_owner_user_id ON copilot_messages(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_runs_owner_user_id ON agent_runs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_owner_user_id ON agent_steps(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_owner_user_id ON agent_tool_calls(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_owner_user_id ON agent_proposals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_approvals_owner_user_id ON agent_approvals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_owner_user_id ON agent_memories(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_memories_owner_scope_key_unique
  ON agent_memories(owner_user_id, scope, key);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_owner_user_id ON agent_schedules(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_owner_user_id ON agent_reminders(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_generated_views_owner_user_id ON generated_views(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_views_owner_slug_unique ON generated_views(owner_user_id, slug);
CREATE INDEX IF NOT EXISTS idx_generated_view_widgets_owner_user_id ON generated_view_widgets(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_projection_scenarios_owner_user_id ON projection_scenarios(owner_user_id);
