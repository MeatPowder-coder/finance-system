-- Optional legacy foreign keys for Copilot tables.
-- Run this only if referenced legacy tables exist in the target database.

DO $$
BEGIN
  IF to_regclass('public.pending_limit_orders') IS NOT NULL THEN
    ALTER TABLE public.react_chat_sessions
      ADD CONSTRAINT react_chat_sessions_pending_limit_order_id_fkey
      FOREIGN KEY (pending_limit_order_id)
      REFERENCES public.pending_limit_orders(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.trades_activos') IS NOT NULL THEN
    ALTER TABLE public.react_chat_sessions
      ADD CONSTRAINT react_chat_sessions_trade_id_fkey
      FOREIGN KEY (trade_id)
      REFERENCES public.trades_activos(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    ALTER TABLE public.react_chat_sessions
      ADD CONSTRAINT react_chat_sessions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public."User"(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL THEN
    ALTER TABLE public.user_memories
      ADD CONSTRAINT user_memories_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public."User"(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
