# Hasura Setup (Finance System)

Guía para habilitar Hasura sobre `finance_system` con metadata versionada.

## Perfil 1: PC local (recomendado para desarrollo)

1. Levanta Postgres local del repo:

```bash
corepack pnpm db:up
corepack pnpm db:migrate
```

2. Variables en `.env.local`:

```env
HASURA_GRAPHQL_ENDPOINT=http://localhost:8086
HASURA_GRAPHQL_ADMIN_SECRET=change_me
HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5434/finance_system
```

3. Levanta Hasura y aplica metadata:

```bash
corepack pnpm hasura:up
corepack pnpm hasura:apply
```

Consola: `http://localhost:8086/console`

## Perfil 2: VM (usando motor `servidor-db` en 5432)

Si en VM usas el Postgres ya existente del host (`servidor-db`), cambia solo la URL de DB:

```env
HASURA_GRAPHQL_DATABASE_URL=postgresql://root:passwordseguro@host.docker.internal:5432/finance_system
```

Luego:

```bash
corepack pnpm hasura:down
corepack pnpm hasura:up
corepack pnpm hasura:apply
```

## Metadata versionada

- Fuente: `hasura/metadata/metadata.json`
- Export viva (auditoría):

```bash
corepack pnpm hasura:export
```

Salida:

- `hasura/metadata/metadata.export.json`

## Qué tablas se trackean

- `accounts`
- `categories`
- `transactions`
- `budgets`
- `budget_lines`
- `recurring_rules`
- `investments`
- `copilot_sessions`
- `copilot_messages`

Incluye relaciones base y permisos `user` amplios de desarrollo.

## Troubleshooting rápido

1. Si Hasura reinicia en loop:

```bash
corepack pnpm hasura:logs
```

2. Error `connection refused` en `5434`:

- Estás apuntando al perfil local sin Postgres local arriba.
- O cambia a perfil VM (`5432`) o levanta `pnpm db:up`.

3. Health check:

```bash
curl -s http://localhost:8086/healthz
```

Debe devolver `OK`.
