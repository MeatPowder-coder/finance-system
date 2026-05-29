# CODEX Master Runbook (PC + VM)

## Objetivo
Tener un flujo único, completo y sin pasos ambiguos para desarrollar `finance-system` en PC y validar/desplegar en VM, sin mezclar dominio financiero nuevo con trading legacy.

## Estado actual del repositorio
Este repositorio ya incluye:

- Web (dashboard, cuentas, transacciones, portfolio, copilot).
- API (`/v1`) con módulos de cuentas, transacciones, inversiones y copilot.
- Desktop con vistas funcionales conectadas al mismo backend.
- Migraciones y scripts para importar datos legacy.
- Hasura con metadata versionada (`hasura/metadata/metadata.json`).

## Arquitectura recomendada de datos (la que debes mantener)

- Un solo motor PostgreSQL en VM: contenedor `servidor-db` (`5432`).
- Dos bases separadas dentro de ese motor:
  - `finanzas` (legacy/trading, solo lectura o importaciones puntuales).
  - `finance_system` (nuevo sistema financiero, desarrollo activo).

No mezclar escritura operativa del nuevo sistema en `finanzas`.

## Flujo principal para PC (desarrollo diario)

1. Sincronizar código:

```bash
git fetch origin
git pull --ff-only origin main
```

2. Preparar entorno:

```bash
corepack enable
corepack pnpm install
cp .env.example .env.local
```

3. Levantar PostgreSQL local de desarrollo:

```bash
corepack pnpm db:up
```

4. Aplicar migraciones:

```bash
corepack pnpm db:migrate
```

5. (Opcional) Importar datos legacy:

```bash
corepack pnpm db:import:legacy -- --dry-run
corepack pnpm db:import:legacy
```

6. (Recomendado) Levantar Hasura + metadata:

```bash
corepack pnpm hasura:up
corepack pnpm hasura:apply
```

7. Ejecutar apps:

```bash
corepack pnpm dev
```

## Flujo de VM (paridad y validación)

En VM, usa `.env.local` apuntando al motor real `servidor-db:5432`:

```env
DATABASE_URL=postgresql://root:passwordseguro@localhost:5432/finance_system
LEGACY_DATABASE_URL=postgresql://root:passwordseguro@localhost:5432/finanzas
HASURA_GRAPHQL_ENDPOINT=http://localhost:8086
HASURA_GRAPHQL_ADMIN_SECRET=change_me
HASURA_GRAPHQL_DATABASE_URL=postgresql://root:passwordseguro@host.docker.internal:5432/finance_system
```

Comandos:

```bash
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm hasura:up
corepack pnpm hasura:apply
corepack pnpm dev
```

## Verificaciones rápidas (obligatorias)

1. API:

```bash
curl -s http://localhost:4100/health
curl -s http://localhost:4100/ready
```

2. Hasura:

```bash
curl -s http://localhost:8086/healthz
```

3. DB nueva (si estás en VM):

```bash
docker exec -i servidor-db psql -U root -d finance_system -c "\\dt"
```

## Qué sí está cubierto y qué no

Cubierto en este repo para desarrollar ya:

- Web/API/Desktop financiero.
- Portfolio financiero.
- Copilot financiero (sesiones + mensajes + endpoint chat).
- Hasura con metadata versionada.

No cubierto como requisito bloqueante de desarrollo base:

- Flujos productivos de NocoDB/n8n específicos de trading legacy.
- Hardening final de permisos Hasura para producción (ahora son permisos amplios de desarrollo).

## Prompts listos para Codex en PC

### Prompt A: Iteración UI

```text
Trabaja solo en finance-system.
Objetivo: mejorar interfaz web y desktop financiera (sin trading).
Reglas:
1) No crear ni tocar módulos de trading.
2) Mantener compatibilidad con API /v1 actual.
3) Mejorar UX de cuentas, transacciones, portfolio y copilot.
4) Al final: correr typecheck y build; listar archivos modificados.
```

### Prompt B: Copilot financiero

```text
Trabaja solo en finance-system.
Objetivo: mejorar copilot financiero.
Incluye:
- mejores respuestas por contexto (saldo, flujo, alertas),
- historial por sesión,
- manejo de errores robusto,
- opción de proveedor LLM por env.
No agregues nada de trading.
```

## Checklist de cierre por cada bloque

1. `corepack pnpm -r typecheck`
2. `corepack pnpm -r build`
3. `curl /health` y `curl /ready`
4. `curl /healthz` de Hasura
5. Confirmar que no se introdujo lógica de trading
