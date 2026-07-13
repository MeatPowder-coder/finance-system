# Hasura Setup (Finance System)

Guia para habilitar Hasura sobre `finance_system`/`finanzas` con metadata versionada.

## Perfil 1: PC local

```bash
pnpm db:up
pnpm db:migrate
pnpm hasura:up
pnpm hasura:apply
```

Variables minimas en `.env.local`:

```env
HASURA_GRAPHQL_ENDPOINT=http://localhost:8086
HASURA_GRAPHQL_ADMIN_SECRET=change_me
HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5434/finance_system
```

Consola: `http://localhost:8086/console`

## Perfil 2: VM

```env
HASURA_GRAPHQL_ENDPOINT=http://hasura:8080
HASURA_GRAPHQL_ADMIN_SECRET=CHANGE_ME
HASURA_GRAPHQL_DATABASE_URL=postgresql://root:CHANGE_ME@servidor-db:5432/finanzas
```

Aplicacion metadata:

```bash
pnpm hasura:up
pnpm hasura:apply
```

El script `hasura:apply` ahora incluye reintentos (para evitar fallos por arranque parcial/`ECONNRESET`).

## Tablas principales trackeadas

- financieras: `accounts`, `transactions`, `categories`, `investments`, `budgets`, `budget_lines`
- copilot: `copilot_sessions`, `copilot_messages`
- agenticas: `agent_runs`, `agent_steps`, `agent_tool_calls`, `agent_proposals`, `agent_approvals`, `generated_views`, `generated_view_widgets`, `agent_schedules`, `agent_reminders`, `projection_scenarios`

## Realtime de producto (Fase 6)

Suscripciones recomendadas para UI:

- propuestas pendientes (`agent_proposals` status `PENDING`)
- recordatorios (`agent_reminders`)
- dashboards generados (`generated_views`)

## Export versionado

```bash
pnpm hasura:export
```

Salida:

- `hasura/metadata/metadata.export.json`
