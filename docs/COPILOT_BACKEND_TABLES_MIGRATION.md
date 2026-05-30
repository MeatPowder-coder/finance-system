# Copilot Backend Tables Migration

Tablas extraídas de la DB legacy (`finanzas`) para backend IA Copilot.

## Archivos

- `db/migrations/003_legacy_copilot_tables.sql`
  - Dump bruto del esquema real (referencia exacta).
- `db/migrations/004_legacy_copilot_tables_compatible.sql`
  - Versión compatible para aplicar en PC.
- `db/migrations/005_legacy_copilot_optional_fks.sql`
  - FKs opcionales hacia tablas legacy (`trades_activos`, `pending_limit_orders`, `User`).

## Qué crea (base)

- `react_chat_sessions`
- `react_chat_messages`
- `chat_history`
- `chat_uploads`
- `lang_ai_memory`
- `user_memories`
- `desktop_device_sessions`

## Aplicación recomendada en PC

```bash
psql "$DATABASE_URL" -f db/migrations/004_legacy_copilot_tables_compatible.sql
```

Si también tienes tablas legacy de trading/usuarios y quieres relaciones completas:

```bash
psql "$DATABASE_URL" -f db/migrations/005_legacy_copilot_optional_fks.sql
```

