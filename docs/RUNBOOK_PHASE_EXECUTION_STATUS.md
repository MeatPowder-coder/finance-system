# Runbook Phase Execution Status

Referencia: `docs/CODEX_PC_VM_MASTER_RUNBOOK 2.md`

## Estado por fase (actual)

- Fase 4 (Desktop parity): **avanzada y alineada**.
  - Desktop ya no usa `iframe`.
  - Reutiliza UI web real (sidebar, tabs y modulos) desde monorepo.
- Fase 5 (IA asistentes / Mastra): **avanzada**.
  - `POST /v1/agents/chat` conectado a runtime real de Mastra (`apps/api/src/agent/mastra-runtime.ts`).
  - Se mantiene compatibilidad con rutas actuales de copilot.
- Fase 6 (Hasura): **avanzada**.
  - Metadata versionada con tablas financieras y agenticas.
  - Script `hasura:apply` con reintentos para startup inestable.
- Fase 7 (n8n): **avanzada**.
  - Bridge operativo `POST /v1/reminders/:id/trigger`.
  - Workflow exportado y versionado: `docs/n8n/finance-reminder-trigger.workflow.json`.
  - Contrato documentado: `docs/N8N_WEBHOOK_CONTRACT.md`.
- Fase 8 (Deploy VM): **en ejecucion con artefactos listos**.
  - `docker-compose.vm.yml` agregado.
  - `.env.vm.example` agregado.
  - Scripts: `pnpm vm:up`, `pnpm vm:down`, `pnpm vm:ps`.

## Pendientes para cierre 100%

1. Ejecutar smoke tests completos en VM con subdominios reales:
   - `finance.<dominio>`
   - `api-finance.<dominio>`
2. Confirmar paridad visual final web vs desktop en Tauri runtime empaquetado.
3. Validar workflow n8n real (email/webhook) con credenciales de entorno.
4. Probar rollback operativo en VM (backup + restore + restart).
