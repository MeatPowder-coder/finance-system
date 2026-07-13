# Finance System Tooling: API + MCP

## Idea central

`finance-system` mantiene la logica financiera como fuente de verdad y expone dos capas de consumo:

- **API**: la interfaz canonica para web, desktop, scripts, Hermes, n8n y cualquier integracion externa.
- **MCP**: una capa para agentes que necesitan descubrir herramientas de forma semantica y usarlas sin conocer la implementacion interna.

La regla es simple:

- la API manda
- MCP adapta
- los agentes consumen

## Que hay disponible hoy

### API

Rutas como:

- `POST /v1/transactions`
- `POST /v1/budgets`
- `POST /v1/reminders`
- `GET /v1/agent-schedules`
- `POST /v1/agent-schedules`
- `PATCH /v1/agent-schedules/:id`
- `POST /v1/generated-views`
- `GET /v1/generated-views/:id`
- `PATCH /v1/generated-views/:id`
- `GET /v1/integrations/telegram/status`
- `POST /v1/integrations/telegram/test-message`
- `POST /v1/integrations/telegram/webhook`
- `GET /v1/budgets?month=YYYY-MM`
- `GET /v1/generated-views`
- `GET /v1/reports/monthly-finance-summary?month=YYYY-MM`

### MCP

El servidor MCP vive en:

- `GET/POST /mcp`
- `GET /v1/mcp/status`
- `GET /v1/mcp/tools`

### Manifiesto publico

Para integraciones externas, usa:

- `GET /v1/tooling/manifest`
- `GET /v1/tooling/examples`
- `GET /v1/tooling/schema`
- `GET /v1/tooling/openapi`

Ese manifiesto resume:

- capacidades disponibles
- rutas REST principales
- transporte recomendado
- tipos de cliente sugeridos
- lista publica de herramientas MCP
- adaptadores remotos opcionales, incluyendo Telegram
- esquemas formales para vistas, schedules y reminders
- especificacion OpenAPI para clientes y agentes que prefieren contratos estandar

Herramientas principales expuestas a agentes:

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

## Como pensar Hermes

Hermes puede ser el agente personal que usa Telegram, crons, correo y recordatorios.

Si Hermes necesita actuar sobre tus finanzas, no deberia tocar la base de datos directamente:

- primero consulta la API o el MCP
- luego decide que herramienta usar
- finalmente ejecuta una accion sobre `finance-system`

Eso permite que Hermes sea poderoso sin convertirlo en una fuente distinta de verdad.

## Como pensar Mastra

Mastra queda como runtime agenetico interno del producto.

Sirve para:

- analisis financiero guiado
- propuestas
- resumenes mensuales
- generacion declarativa de dashboards
- automatizaciones controladas
- cron jobs y schedules controlados

Mastra y Hermes pueden compartir el mismo toolkit porque ambos usan las mismas herramientas de negocio.

## Dashboards con agente

La recomendacion es que el agente no escriba React libremente al principio.

Mejor:

1. el agente genera una definicion declarativa del dashboard
2. la app renderiza widgets permitidos
3. el usuario publica o guarda esa vista

Una vista generada puede mezclar tabs y widgets. Por ejemplo:

```json
{
  "title": "Plan de salida de deudas",
  "layout": "GRID",
  "status": "DRAFT",
  "tabs": [
    {
      "key": "overview",
      "title": "Resumen",
      "order": 1,
      "widgetKeys": ["debt_kpi", "monthly_payments"]
    },
    {
      "key": "timeline",
      "title": "Cronograma",
      "order": 2,
      "widgetKeys": ["debt_timeline"]
    }
  ],
  "widgets": [
    {
      "widgetKey": "debt_kpi",
      "widgetType": "metric",
      "title": "Deuda total",
      "position": 1,
      "dataSource": "monthly_finance_snapshot"
    },
    {
      "widgetKey": "monthly_payments",
      "widgetType": "bar_chart",
      "title": "Pagos mensuales",
      "position": 2,
      "dataSource": "transactions_by_category"
    },
    {
      "widgetKey": "debt_timeline",
      "widgetType": "timeline",
      "title": "Ruta de salida",
      "position": 3,
      "dataSource": "projection_scenarios"
    }
  ]
}
```

Y un schedule/cron puede verse así:

```json
{
  "name": "Revisar deuda cada viernes",
  "cadence": "FREQ=WEEKLY;BYDAY=FR",
  "timezone": "America/Bogota",
  "isActive": true,
  "payload": {
    "purpose": "debt_review",
    "reminderChannel": "N8N"
  }
}
```

Ejemplo de componentes:

- metricas
- barras
- tablas
- lineas
- timeline
- proyeccion de deuda
- rendimiento de inversion

## Reglas sanas

- No duplicar logica entre API, MCP y agentes.
- No hacer que un bot escriba directo en la DB.
- No generar pantallas arbitrarias sin sandbox.
- Usar MCP para descubrimiento y ergonomia de agente.
- Usar API para integridad, pruebas y portabilidad.
- Usar schedules para cron jobs y reminders sin duplicar la logica del tiempo.

## Telegram / Hermes como front door remoto

Si quieres manejar el sistema por Telegram, `finance-system` expone un adaptador ligero y opcional, y Hermes puede seguir siendo el operador remoto principal.

Flujo recomendado:

1. El usuario escribe en Telegram.
2. Hermes interpreta la intencion.
3. Hermes llama la API, el MCP o el webhook Telegram de `finance-system`.
4. `finance-system` ejecuta la logica real.
5. Hermes devuelve la respuesta o programa un cron, recordatorio o dashboard.

Eso permite:

- mantener un solo backend financiero
- reutilizar el mismo contrato con Hermes, Mastra, Claude Code o Codex
- no duplicar la logica de Telegram en la app financiera
- usar Hermes como capa de automatizacion y conversational ops
- usar Telegram como canal remoto opcional con el mismo contrato

Ejemplos de acciones remotas que encajan bien:

- crear recordatorios semanales
- revisar deficit mensual
- generar dashboards declarativos
- crear schedules/cron jobs
- registrar una transaccion
- crear un presupuesto
- publicar una vista o tab generada
- consultar status y recordatorios por Telegram

## Resultado esperado

Con esta base, puedes:

- hablarle a Hermes en Telegram
- exponer capacidades a Mastra dentro de la app
- reutilizar las mismas herramientas para ambos
- mantener una sola verdad financiera
- usar la API REST o MCP segun convenga al agente o al cliente

## Lectura recomendada

Si vas a integrar un agente nuevo, empieza por:

- [Agent Integration Playbook](./AGENT_INTEGRATION_PLAYBOOK.md)
