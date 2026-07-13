# Agent Integration Playbook

Este playbook explica, en forma practica, como conectar cualquier IA o bot con `finance-system` sin leer el codigo fuente.

## 1) Que debe descubrir primero cualquier agente

La entrada mas simple es el manifiesto publico:

- `GET /v1/tooling/manifest`
- `GET /v1/tooling/examples`
- `GET /v1/tooling/schema`
- `GET /v1/tooling/openapi`

Ese manifiesto dice:

- que capacidades existen
- que rutas REST estan disponibles
- que transporte MCP existe
- si Telegram esta habilitado como adaptador remoto
- que herramientas puede usar el agente

Si el agente soporta MCP, tambien puede descubrir:

- `GET /v1/mcp/status`
- `GET /v1/mcp/tools`
- `/mcp`

## 2) Reglas de uso

- Usa **API REST** para escrituras, automatizaciones y operaciones confiables.
- Usa **MCP** para descubrimiento de herramientas y experiencias agenticas.
- Usa **Telegram** solo como adaptador remoto opcional.
- Usa **vistas generadas** para dashboards y tabs.
- Usa **schedules** para crons y recordatorios temporales.

## 3) Flujo recomendado para cualquier IA

1. Leer `GET /v1/tooling/manifest`.
2. Si necesita contratos estandar, leer `GET /v1/tooling/openapi`.
3. Si necesita herramientas semanticas, conectar MCP en `/mcp`.
4. Si va a operar de forma directa, usar REST.
4. Para dashboards, crear una `generated-view`.
5. Para cron jobs, crear un `schedule`.
6. Para notificaciones, crear un `reminder`.
7. Para uso remoto, pasar por Telegram via Hermes o por el webhook opcional.

Si quieres una prueba rapida sin escribir cliente, ejecuta:

```bash
pnpm agent:bootstrap-demo
```

Y si quieres crear la demo completa:

```bash
pnpm agent:bootstrap-demo -- --create-demo
```

Si prefieres un SDK TypeScript listo para usar, mira:

- [`@finance-system/client`](../packages/client/README.md)

## 4) Ejemplos de integracion

### Hermes

Hermes debe actuar como frente remoto personal. Su flujo ideal es:

1. Telegram -> Hermes
2. Hermes -> `finance-system` REST o MCP
3. `finance-system` -> DB / reportes / vistas
4. Hermes -> respuesta o recordatorio

Ejemplos de tareas adecuadas:

- `crea un resumen mensual de deuda`
- `configura un recordatorio cada viernes`
- `crea un dashboard de flujo de caja`
- `mueve esta operacion al sistema financiero`

### Mastra

Mastra puede actuar como copilot interno del producto.

Usa el mismo toolkit:

- `finance_get_snapshot`
- `finance_create_schedule`
- `finance_create_reminder`
- `finance_upsert_generated_view`

Mastra debe preferir `POST /v1/agents/chat` cuando necesita razonamiento guiado y `POST /v1/generated-views` cuando la salida sea una vista estructurada.

### Claude Code / Codex

Para un agente de coding o automacion, lo mas estable es:

1. leer el manifiesto
2. enumerar herramientas MCP
3. si necesita escribir algo en el sistema, usar REST

Ejemplo de orden:

```text
GET /v1/tooling/manifest
GET /v1/mcp/tools
POST /v1/generated-views
POST /v1/agent-schedules
POST /v1/reminders
```

### Telegram

Telegram no debe ser una segunda logica financiera.

Debe usarse como canal remoto:

- revisar status
- consultar recordatorios
- mandar mensajes a Hermes
- disparar respuestas del agente

Si `TELEGRAM_BOT_TOKEN` y `TELEGRAM_DEFAULT_CHAT_ID` estan configurados, el adaptador puede responder:

- `/start`
- `/help`
- `/status`
- `/reminders`
- texto libre para consultas financieras

## 5) Ejemplos REST concretos

### Crear vista / dashboard

```http
POST /v1/generated-views
Content-Type: application/json
```

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

### Crear schedule / cron

```http
POST /v1/agent-schedules
Content-Type: application/json
```

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

### Crear reminder

```http
POST /v1/reminders
Content-Type: application/json
```

```json
{
  "title": "Resumen mensual deuda",
  "cadence": "MONTHLY",
  "channel": "EMAIL",
  "messageTemplate": "Revisa intereses y progreso de deuda",
  "timezone": "America/Bogota"
}
```

## 6) Ejemplo de secuencia para un agente nuevo

```text
1. GET /v1/tooling/manifest
2. GET /v1/tooling/examples
3. GET /v1/mcp/status
4. GET /v1/mcp/tools
5. POST /v1/generated-views
6. POST /v1/agent-schedules
7. POST /v1/reminders
8. PATCH /v1/generated-views/:id
```

## 7) Que no hacer

- No escribir directo a la base de datos.
- No duplicar la logica financiera en Telegram.
- No inventar dashboards fuera del formato declarativo.
- No crear otra fuente de verdad.

## 8) Resultado deseado

Con este contrato, cualquier IA puede:

- leer el estado financiero
- crear dashboards
- programar cron jobs
- enviar recordatorios
- operar por Telegram de forma remota
- usar API o MCP segun su arquitectura
