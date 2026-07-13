-- Allow TELEGRAM as a first-class reminder delivery channel.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS agent_reminders
  DROP CONSTRAINT IF EXISTS agent_reminders_channel_check;

ALTER TABLE IF EXISTS agent_reminders
  ADD CONSTRAINT agent_reminders_channel_check
  CHECK (channel IN ('IN_APP', 'EMAIL', 'WEBHOOK', 'N8N', 'TELEGRAM'));
