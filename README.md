# Finance System

Sistema financiero/contable personal en monorepo (web + desktop + API).

## Alcance

Este repositorio es el producto activo para evolucionar el dominio financiero sin dependencias de trading.

Incluye:

- API financiera (Fastify + PostgreSQL)
- Cliente web (Next.js)
- Cliente desktop (React / Vite, Tauri-ready)
- Migraciones SQL versionadas
- Puente de importacion de datos legacy (`trading-journal`)

## Estructura

- `apps/web`: frontend web
- `apps/api`: backend financiero
- `apps/desktop`: cliente desktop
- `packages/shared`: tipos compartidos
- `db/migrations`: esquema y migraciones
- `docs`: documentacion tecnica

## Requisitos

- Node 20+
- pnpm 9+
- Docker (opcional, para Postgres local)

## Inicio rapido local

1. Instalar dependencias:

```bash
pnpm install
```

2. Configurar variables:

```bash
cp .env.example .env.local
```

3. Levantar PostgreSQL local (opcional pero recomendado):

```bash
make up
```

4. Ejecutar migraciones (`001` y `002`) en tu DB.

5. Levantar apps:

```bash
pnpm dev
```

## Endpoints API principales

- `GET /health`
- `GET /v1/meta`
- `GET /v1/accounts`
- `POST /v1/accounts`
- `PATCH /v1/accounts/:id`
- `GET /v1/transactions`
- `POST /v1/transactions`
- `GET /v1/summary`

## Migracion desde trading-journal

Revisa:

- `db/migrations/002_legacy_finance_bridge.sql`
- `docs/migration-from-trading-journal.md`

La migracion importa cuentas/transacciones legacy de forma idempotente y sin arrastrar modulos de trading.

## Estado

Baseline funcional listo para desarrollo real en PC.
