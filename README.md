# Finance System

Sistema financiero/contable personal (web + desktop + API) construido como monorepo.

## Objetivo

Reemplazar el enfoque de trading por un producto centrado en:

- Cuentas y saldos
- Transacciones y conciliación
- Presupuestos
- Recurrentes
- Deuda/tarjetas
- Reportes financieros

## Estructura

- `apps/web`: frontend web (Next.js)
- `apps/api`: API backend (Fastify + PostgreSQL)
- `apps/desktop`: cliente desktop (React/Tauri-ready)
- `packages/shared`: tipos y utilidades compartidas
- `db/migrations`: migraciones SQL
- `docs`: documentación técnica

## Quickstart (local)

1. Instalar dependencias:

```bash
pnpm install
```

2. Configurar variables:

```bash
cp .env.example .env.local
```

3. Levantar API y Web:

```bash
pnpm dev
```

- Web: `http://localhost:3005`
- API: `http://localhost:4100`

## Estado actual

Scaffold inicial del producto financiero con dominio contable base y migración inicial.
