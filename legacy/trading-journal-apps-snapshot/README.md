# Trading Journal Apps Snapshot (Exact Copy)

Copia literal de carpetas `trading-journal/apps/*` para migración a PC.

Incluye:

- `apps/api` (backend Fastify del journal, incl. rutas `desktop-unified`, `desktop`, `trade-tracking`)
- `apps/desktop` (cliente desktop)

Excluidos únicamente artefactos de build:

- `node_modules/`
- `dist/`
- `target/`
- `.next/`

Objetivo:

- Tener en `finance-system` una base exacta de lo que YA corre en VM para mover backend/frontend de journal a PC sin reinterpretaciones.
