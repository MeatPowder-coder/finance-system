# CODEX Master Runbook (PC + VM)

## Objetivo
Tener un flujo único, completo y sin pasos ambiguos para desarrollar `finance-system` en PC con paridad suficiente en VM.

## Estado del repositorio
Este repositorio ya incluye:

- Web con tabs: dashboard, cuentas, transacciones, portfolio, copilot.
- API con módulos completos de cuentas/transacciones/inversiones/copilot.
- Desktop con tabs funcionales para inspección operativa.
- Scripts de bootstrap, migración e importación legacy.

## Flujo recomendado para PC (principal)

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

3. Levantar PostgreSQL local:

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

6. Ejecutar apps:

```bash
corepack pnpm dev
```

## Flujo recomendado para VM (motor único, 2 bases)

Escenario recomendado:

- Motor PostgreSQL único: `servidor-db` (`5432`)
- Base legacy intacta: `finanzas`
- Base nueva de producto: `finance_system`

Configurar `.env.local` de VM para apuntar a `finance_system`:

```env
DATABASE_URL=postgresql://root:passwordseguro@localhost:5432/finance_system
LEGACY_DATABASE_URL=postgresql://root:passwordseguro@localhost:5432/finanzas
```

Luego:

```bash
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev
```

## Prompts listos para Codex en PC

### Prompt 1: Iteración UI financiera

```text
Trabaja solo en finance-system.
Objetivo: mejorar interfaz web y desktop financiera (sin trading).
Reglas:
1) No crear ni tocar módulos de trading.
2) Mantener compatibilidad con API /v1 actual.
3) Mejorar UX de cuentas, transacciones, portfolio y copilot.
4) Al final: correr typecheck y build; listar archivos modificados.
```

### Prompt 2: Copilot financiero

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

## Checklist de salida por bloque

1. `corepack pnpm -r typecheck`
2. `corepack pnpm -r build`
3. Verificar `/health` y `/ready`
4. Validar `/v1/summary`
5. Confirmar que no se introdujo lógica de trading
