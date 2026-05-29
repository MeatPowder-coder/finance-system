# Finance System

Sistema financiero/contable en monorepo con stack completo para desarrollo en PC:

- Web (Next.js)
- API (Fastify + PostgreSQL)
- Desktop (React/Vite)
- Portfolio financiero
- Copilot financiero (sesiones + mensajes + respuesta asistida)
- Hasura (metadata versionada)

## Qué incluye hoy

- Cuentas y saldos
- Transacciones
- Portfolio de inversiones
- Copilot financiero persistente
- Migraciones SQL versionadas
- Scripts de bootstrap y migración legacy
- Stack Hasura local + metadata en repo

## Estructura

- `apps/web`: interfaz web principal
- `apps/api`: backend financiero
- `apps/desktop`: cliente desktop
- `db/migrations`: esquema y evolutivos
- `hasura/metadata`: metadata versionada
- `scripts`: utilidades de migración y setup
- `docs`: documentación técnica

## Flujo único para PC (rápido)

1. Instalar dependencias y levantar DB local:

```bash
corepack enable
corepack pnpm install
cp .env.example .env.local
corepack pnpm db:up
```

2. Aplicar migraciones:

```bash
corepack pnpm db:migrate
```

3. (Opcional) Importar datos legacy:

```bash
corepack pnpm db:import:legacy -- --dry-run
corepack pnpm db:import:legacy
```

4. (Opcional recomendado) Levantar Hasura y aplicar metadata:

```bash
corepack pnpm hasura:up
corepack pnpm hasura:apply
```

5. Levantar apps:

```bash
corepack pnpm dev
```

## Endpoints API principales

- `GET /health`
- `GET /ready`
- `GET /v1/meta`
- `GET /v1/summary`
- `GET/POST/PATCH /v1/accounts`
- `GET/POST /v1/transactions`
- `GET/POST/PATCH /v1/investments`
- `GET /v1/copilot/sessions`
- `POST /v1/copilot/sessions`
- `GET /v1/copilot/sessions/:id/messages`
- `POST /v1/copilot/chat`

## Hasura

Guía completa:

- `docs/hasura-setup.md`

Comandos:

- `corepack pnpm hasura:up`
- `corepack pnpm hasura:apply`
- `corepack pnpm hasura:export`
- `corepack pnpm hasura:down`

## Notas

- El API carga variables automáticamente desde `.env.local` en modo `dev`.
- `OPENAI_API_KEY` es opcional. Si no existe, el Copilot usa respuesta basada en reglas + contexto financiero real.
