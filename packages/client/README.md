# @finance-system/client

Cliente ligero para integrar agentes, bots o scripts con `finance-system`.

## Uso

```ts
import { createFinanceSystemClient } from "@finance-system/client";

const client = createFinanceSystemClient({
  baseUrl: "http://localhost:4100",
});

const manifest = await client.getManifest();
const schema = await client.getSchema();
const openApi = await client.getOpenApi();
const views = await client.getGeneratedViews();
```

## Capacidades

- leer manifiesto público
- leer schema formal
- leer OpenAPI
- listar y crear vistas/tableros
- listar y crear schedules / cron jobs
- listar y crear reminders
- consultar Telegram status y probar mensajes

## Idea de integracion

- Hermes: usar este cliente desde Telegram o desde su orquestador
- Mastra: usarlo como toolkit de producto
- Claude Code / Codex: usarlo para automatizaciones y vistas
- Scripts: usarlo para bootstrap o demos

