# PC Development Assets Inventory (Finance System)

Este documento enumera TODO lo que ya está en el repositorio para comenzar desarrollo en PC sin depender del `trading-journal` original.

## 1) Monorepo y apps

- `apps/web` (Next.js 14): interfaz financiera completa.
- `apps/api` (Fastify + PostgreSQL): backend `/v1`.
- `apps/desktop` (React + Vite): cliente desktop conectado al mismo API.
- `packages/shared`: utilidades compartidas del monorepo.

## 2) Dominio financiero migrado

Tablas base en `finance_system`:

- `accounts`
- `categories`
- `transactions`
- `budgets`
- `budget_lines`
- `recurring_rules`
- `investments`
- `copilot_sessions`
- `copilot_messages`
- `schema_migrations`

Migraciones:

- `db/migrations/001_finance_core.sql`
- `db/migrations/002_legacy_finance_bridge.sql`

## 3) Backend funcional disponible

Endpoints activos para desarrollo:

- Salud: `GET /health`, `GET /ready`
- Meta/resumen: `GET /v1/meta`, `GET /v1/summary`
- Cuentas: `GET/POST/PATCH /v1/accounts`
- Transacciones: `GET/POST /v1/transactions`
- Inversiones: `GET/POST/PATCH /v1/investments`
- Copilot: 
  - `GET /v1/copilot/sessions`
  - `POST /v1/copilot/sessions`
  - `GET /v1/copilot/sessions/:id/messages`
  - `POST /v1/copilot/chat`

## 4) Hasura integrado

Archivos y comandos incluidos:

- Compose local: `docker-compose.hasura.local.yml`
- Metadata versionada: `hasura/metadata/metadata.json`
- Scripts: 
  - `scripts/hasura-apply-metadata.mjs`
  - `scripts/hasura-export-metadata.mjs`
- Scripts `pnpm` root:
  - `hasura:up`, `hasura:down`, `hasura:ps`, `hasura:logs`, `hasura:apply`, `hasura:export`

## 5) Apariencia visual migrada desde journal

Se migró capa visual (look & feel) del estilo journal a:

- Web: `apps/web/app/globals.css`
- Desktop: `apps/desktop/src/styles.css`
- Desktop app con clases visuales homogéneas: `apps/desktop/src/App.tsx`

Incluye:

- Tema oscuro técnico con gradientes y cards tipo dashboard.
- Tabs, tablas, badges y formularios con estilos consistentes.
- Vistas de dashboard/cuentas/transacciones/portfolio/copilot con misma línea visual en web y desktop.

## 6) Variables de entorno necesarias

Plantilla base en `.env.example`.

Críticas para arrancar en PC:

- `DATABASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `VITE_API_BASE_URL`

Para Hasura:

- `HASURA_GRAPHQL_ENDPOINT`
- `HASURA_GRAPHQL_ADMIN_SECRET`
- `HASURA_GRAPHQL_DATABASE_URL`

Opcionales para IA:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## 7) Flujo de arranque completo en PC

```bash
corepack enable
corepack pnpm install
cp .env.example .env.local
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm hasura:up
corepack pnpm hasura:apply
corepack pnpm dev
```

## 8) Qué NO se migró a propósito

- Lógica operativa de trading (trades, órdenes, footprint, etc.).
- Dependencias de UI amarradas a trading real-time.
- Automatizaciones legacy de trading en NocoDB/n8n.

## 9) Estado objetivo para trabajar tranquilo en PC

Si estos checks pasan, el entorno está completo:

```bash
curl -s http://localhost:4100/health
curl -s http://localhost:4100/ready
curl -s http://localhost:8086/healthz
```

Y en UI:

- Web en `http://localhost:3005`
- Desktop en `http://localhost:1420`
