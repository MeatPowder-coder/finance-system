-- Agentic foundation tables (Mastra-ready runtime data model)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(30) NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB', 'DESKTOP', 'API', 'SYSTEM')),
  agent_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  user_message TEXT NOT NULL,
  assistant_message TEXT,
  model_requested VARCHAR(120),
  model_resolved VARCHAR(120),
  error_code VARCHAR(80),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_name ON agent_runs(agent_name);

CREATE TABLE IF NOT EXISTS agent_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_run_id ON agent_steps(run_id);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_id BIGINT REFERENCES agent_steps(id) ON DELETE SET NULL,
  tool_name VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run_id ON agent_tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_tool_name ON agent_tool_calls(tool_name);

CREATE TABLE IF NOT EXISTS agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  proposal_type VARCHAR(50) NOT NULL CHECK (proposal_type IN ('CREATE_DASHBOARD', 'CREATE_REMINDER', 'CREATE_PROJECTION', 'CODE_CHANGE_REQUEST', 'WRITE_OPERATION')),
  title VARCHAR(220) NOT NULL,
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_proposals_created_at ON agent_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_status ON agent_proposals(status);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id BIGSERIAL PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES agent_proposals(id) ON DELETE CASCADE,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
  reason TEXT,
  actor VARCHAR(120) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_proposal_id ON agent_approvals(proposal_id);

CREATE TABLE IF NOT EXISTS agent_memories (
  id BIGSERIAL PRIMARY KEY,
  scope VARCHAR(50) NOT NULL DEFAULT 'USER' CHECK (scope IN ('USER', 'SYSTEM')),
  key VARCHAR(120) NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, key)
);

CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(220) NOT NULL,
  cadence VARCHAR(80) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_active ON agent_schedules(is_active);

CREATE TABLE IF NOT EXISTS agent_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES agent_schedules(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP', 'EMAIL', 'WEBHOOK', 'N8N')),
  target VARCHAR(300),
  message_template TEXT NOT NULL,
  next_run_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reminders_next_run_at ON agent_reminders(next_run_at);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_status ON agent_reminders(status);

CREATE TABLE IF NOT EXISTS generated_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_proposal_id UUID REFERENCES agent_proposals(id) ON DELETE SET NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  layout VARCHAR(30) NOT NULL DEFAULT 'GRID' CHECK (layout IN ('GRID', 'STACK')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_views_status ON generated_views(status);

CREATE TABLE IF NOT EXISTS generated_view_widgets (
  id BIGSERIAL PRIMARY KEY,
  view_id UUID NOT NULL REFERENCES generated_views(id) ON DELETE CASCADE,
  widget_key VARCHAR(120) NOT NULL,
  widget_type VARCHAR(40) NOT NULL CHECK (widget_type IN ('metric', 'table', 'line_chart', 'bar_chart', 'pie_chart', 'timeline', 'monthly_cashflow', 'debt_projection', 'investment_return', 'portfolio_performance')),
  title VARCHAR(220) NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  data_source VARCHAR(120) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (view_id, widget_key)
);

CREATE INDEX IF NOT EXISTS idx_generated_view_widgets_view_id ON generated_view_widgets(view_id);

CREATE TABLE IF NOT EXISTS projection_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES agent_proposals(id) ON DELETE SET NULL,
  scenario_type VARCHAR(40) NOT NULL CHECK (scenario_type IN ('DEBT_PAYOFF', 'CASHFLOW', 'INVESTMENT')),
  title VARCHAR(220) NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projection_scenarios_type ON projection_scenarios(scenario_type);
