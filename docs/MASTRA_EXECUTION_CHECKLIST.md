# Mastra Execution Checklist

Estado: ejecutado en backend base y toolkit compartido.

## 1) Implementado

- Runtime Mastra real en `apps/api/src/agent/mastra-runtime.ts`.
- Integracion activa en `POST /v1/agents/chat` (sin fallback de plantilla local).
- Tool registry inicial:
  - `finance_context_tool`
  - `proposal_builder_tool`
- Tooling compartido de negocio:
  - `finance_get_snapshot`
  - `finance_list_accounts`
  - `finance_list_transactions`
  - `finance_create_transaction`
  - `finance_list_budgets`
  - `finance_create_budget`
  - `finance_list_generated_views`
  - `finance_upsert_generated_view`
  - `finance_list_schedules`
  - `finance_create_schedule`
  - `finance_update_schedule`
  - `finance_list_reminders`
  - `finance_create_reminder`
  - `finance_list_projection_scenarios`
  - `finance_create_projection_scenario`
  - `finance_monthly_summary`
- MCP HTTP disponible en `/mcp`.
- Persistencia de trazas basicas en DB:
  - `agent_runs`
  - `agent_steps`
  - `agent_tool_calls`
  - `agent_proposals`

## 2) Variables requeridas

- `AGENT_RUNTIME_ENABLED=true`
- `COPILOT_DEFAULT_MODEL=gemini-2.5-flash-lite` (u otro permitido)
- `GOOGLE_GENERATIVE_AI_API_KEY` y/o `OPENAI_API_KEY`
- `GOOGLE_API_KEY` (alias para Mastra; puede ser el mismo valor de Google)

## 3) Verificacion rapida

```bash
pnpm dev:api
curl -X POST http://localhost:4100/v1/agents/chat -H "Content-Type: application/json" -d "{\"message\":\"Dame resumen de flujo del mes\",\"channel\":\"WEB\"}"
```

## 4) Siguiente iteracion recomendada

1. Agregar memoria multi-sesion de Mastra sobre tablas existentes.
2. Expandir MCP con recursos de lectura y automatizaciones aprobadas.
3. Añadir stream visible en frontend para `/v1/agents/chat`.
