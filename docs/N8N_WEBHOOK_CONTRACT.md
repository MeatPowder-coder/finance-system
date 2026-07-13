# n8n Webhook Contract (Fase 7)

Endpoint bridge API:

- `POST /v1/reminders/:id/trigger`

Headers outbound hacia n8n:

- `Authorization: Bearer ${N8N_WEBHOOK_TOKEN}` (si existe token)
- `Content-Type: application/json`

Payload outbound:

```json
{
  "event": "agent_reminder_triggered",
  "reminderId": "uuid",
  "scheduleId": "uuid",
  "title": "Recordatorio",
  "message": "Texto del recordatorio",
  "channel": "EMAIL",
  "target": "usuario@correo.com",
  "nextRunAt": "2026-06-01T00:00:00.000Z",
  "metadata": {},
  "triggeredAt": "2026-06-01T00:00:00.000Z"
}
```

Respuesta esperada de n8n:

- `2xx` con JSON; la API marca `last_triggered_at` y retorna `delivered: true`.
- `4xx/5xx` o timeout: la API devuelve error y no marca entrega exitosa.

Retry:

- El caller (UI/worker) puede reintentar `POST /v1/reminders/:id/trigger`.
- Se recomienda workflow idempotente por `reminderId + triggeredAt`.
