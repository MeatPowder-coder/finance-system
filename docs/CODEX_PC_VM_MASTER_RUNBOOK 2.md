# CODEX Master Runbook (PC + VM)

## Objetivo
Esta guía define cómo trabajar con Codex desde tu PC para evolucionar `finance-system` como producto principal, reutilizando sólo la parte financiera del proyecto legado (`trading-journal`) y manteniendo la infraestructura actual en la VM (Postgres, Hasura, NocoDB, n8n, proxy y servicios auxiliares).

Fecha de referencia de este inventario: `2026-05-24`.

---

## 1) Estado actual de infraestructura (VM)

### 1.1 Repositorios y carpetas
- Proyecto legado activo en VM: `/home/ubuntu/trading-journal`
- Stack de automatización/datos en VM: `/home/ubuntu/n8n`
- Nuevo proyecto financiero: `/home/ubuntu/finance-system`

### 1.2 Servicios detectados en `/home/ubuntu/trading-journal/docker-compose.prod.yml`
- `trading-journal-web`
- `alerts-monitor`
- `binance-listener-dev`
- Red compartida: `infra-net` (externa)

### 1.3 Servicios detectados en `/home/ubuntu/n8n/docker-compose.yml`
- `npm` (Nginx Proxy Manager)
- `postgres` (`pgvector/pgvector:pg18`, contenedor `servidor-db`)
- `n8n`
- `static_server`
- `graphql-engine` (Hasura, contenedor `hasura`)
- `nocodb`
- `agente-voz`
- `dashboard`
- `binance-listener`
- Red compartida: `infra-net` (externa)

### 1.4 Variables sensibles observadas (sólo nombres)
En `/home/ubuntu/n8n/.env` aparecen estas llaves (sin exponer valores):
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `GROQ_API_KEY`
- `CARTESIA_API_KEY`
- `ELEVEN_API_KEY`

---

## 2) Modelo operativo recomendado

## 2.1 Repositorios (rol claro)
- `trading-journal-archive`: sólo archivo técnico y consulta (read-only funcional).
- `finance-system`: desarrollo activo de producto financiero/contable (web + desktop + API + data).

## 2.2 Dónde desarrollar
- Código de producto: en tu PC, dentro de `finance-system`.
- Integración/validación de infraestructura: en VM (staging/prod light).
- Codex trabaja principalmente en tu PC sobre `finance-system`; en VM sólo para despliegue, migración y pruebas de integración.

## 2.3 ¿Una DB o dos?
No es obligatorio tener dos motores de DB, pero sí debes tener separación por entorno.

Recomendación profesional:
- Local (PC): 1 PostgreSQL local para dev (`finance_local`).
- VM: PostgreSQL de infraestructura (`servidor-db`) con base separada para finance (`finance_system` o `finance_system_staging`).

Evita usar la misma base/dataset entre local y VM. Puedes usar el mismo motor PostgreSQL, pero no la misma base de datos compartida para desarrollo diario.

---

## 3) Estrategia de entornos

## 3.1 Dev local (PC)
- Objetivo: construir rápido, romper sin riesgo, iterar UI/API.
- Servicios mínimos:
  - `apps/web`
  - `apps/api`
  - `apps/desktop`
  - PostgreSQL local
- Hasura local: opcional al inicio; recomendado cuando ya tengas dominio estable.

## 3.2 Staging (VM)
- Objetivo: validar integración real (Hasura, NocoDB, OAuth, n8n, subdominios, TLS, red docker).
- Servicios:
  - PostgreSQL VM (base separada)
  - Hasura VM (metadata separada para finance)
  - NocoDB VM (si lo usarás para vistas operativas)
  - API/Web/Desktop build artefacts (según estrategia)

## 3.3 Producción
- Cuando estés listo, usa la VM como prod inicial, pero mantén:
  - backups automáticos,
  - secretos fuera de git,
  - migraciones versionadas,
  - checklist de release.

---

## 4) Seguridad y compliance mínimo

Antes de avanzar:
1. Rotar secretos históricos del proyecto legado.
2. Confirmar que ningún `.env*` real se suba a GitHub.
3. Mantener `.env.example` completo pero sin valores reales.
4. Crear matriz de secretos por entorno (`local`, `staging`, `prod`) en doc privado.
5. Evitar credenciales hardcodeadas en `docker-compose`.

Regla: el repositorio público nunca debe contener valores reales de tokens, passwords ni secretos JWT/OAuth.

---

## 5) Flujo Git profesional (día a día)

1. Rama por feature en `finance-system`.
2. Commits pequeños y atómicos.
3. PR con:
   - objetivo,
   - alcance,
   - riesgos,
   - checklist de pruebas.
4. Merge sólo con checks verdes.
5. Tag en hitos (`v0.1.0`, etc.)

Convención sugerida de commits:
- `feat(scope): ...`
- `fix(scope): ...`
- `refactor(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

---

## 6) Roadmap técnico por fases (lo que Codex debe ejecutar)

## Fase 0: baseline estable
Objetivo:
- dejar `finance-system` ejecutando web/api/desktop en local.

Tareas:
1. Validar scripts de monorepo (`pnpm dev`, `build`, `typecheck`).
2. Añadir `docker-compose.local.yml` con PostgreSQL local.
3. Corregir/validar migraciones SQL iniciales.
4. Añadir `Makefile` o scripts npm para bootstrap.

Criterios de aceptación:
- onboarding en < 10 minutos en máquina nueva.

## Fase 1: modelo contable núcleo
Objetivo:
- dominio financiero robusto (sin trading).

Tareas:
1. Rediseñar tablas núcleo:
   - `accounts`
   - `transactions`
   - `categories`
   - `counterparties`
   - `tags`
   - `attachments`
   - `transaction_splits`
2. Añadir doble-entry opcional (ledger/journal) o plan contable simplificado.
3. Constraints e índices por consultas reales.
4. Migraciones idempotentes y reversibles cuando aplique.

Criterios de aceptación:
- se pueden registrar transacciones complejas y reconstruir saldos por fecha.

## Fase 2: backend API
Objetivo:
- API consistente, testeable y sin endpoints legacy de trading.

Tareas:
1. Módulos API por dominio (`accounts`, `transactions`, `budgets`, `reports`, `investments`, `ai-assistant`).
2. Validación de payloads con Zod.
3. Manejo de errores estandarizado.
4. Health checks y readiness.
5. Tests de integración mínimos por módulo crítico.

Criterios de aceptación:
- contrato estable para web/desktop.

## Fase 3: frontend web
Objetivo:
- UI financiera completa (no trading).

Tareas:
1. Dashboard financiero (cashflow, net worth, deuda, presupuesto).
2. CRUD completo de cuentas/transacciones/categorías.
3. Filtros avanzados y conciliación.
4. Reportes mensuales/anuales exportables.
5. Módulo de inversiones (portafolio financiero, sin señales de trading).

Criterios de aceptación:
- navegación completa sin depender de pantallas legacy.

## Fase 4: desktop app
Objetivo:
- parity funcional razonable con web.

Tareas:
1. Definir modo desktop (online-first o híbrido con caché local).
2. Compartir componentes/lógica entre web y desktop cuando sea viable.
3. Configurar empaquetado y release notes.

Criterios de aceptación:
- flujos núcleo operan en desktop sin hacks manuales.

## Fase 5: IA asistentes
Objetivo:
- conservar asistentes IA útiles para finanzas, eliminando trading.

Tareas:
1. Prompting orientado a contabilidad personal/empresarial.
2. Herramientas permitidas: análisis de transacciones, presupuestos, proyección de flujo.
3. Eliminar herramientas/routers de trading (Binance, SL/TP, órdenes).
4. Auditoría de prompts para evitar fuga de datos sensibles.

Criterios de aceptación:
- asistente responde sobre finanzas y rechaza rutas de trading.

## Fase 6: Hasura
Objetivo:
- capa GraphQL limpia y desacoplada de trading.

Tareas:
1. Definir proyecto de metadata para `finance-system` (separado del legado).
2. Trackear sólo tablas/views financieras.
3. Configurar permisos por roles (user/admin).
4. Versionar metadata en repo.

Criterios de aceptación:
- metadata reproducible en local/staging/prod.

## Fase 7: NocoDB + n8n
Objetivo:
- automatizaciones y vistas operativas sin afectar núcleo.

Tareas:
1. Definir qué vive en app y qué en NocoDB.
2. Usar n8n para ETLs, alertas, integraciones externas, recordatorios.
3. Mantener workflows versionados (export JSON + documentación).
4. No meter reglas de negocio críticas sólo en n8n.

Criterios de aceptación:
- automatizaciones observables y recuperables.

## Fase 8: despliegue en VM
Objetivo:
- pipeline simple y confiable.

Tareas:
1. Definir `docker-compose` propio para `finance-system`.
2. Asignar subdominios (ejemplo):
   - `finance.tudominio.com` (web)
   - `api-finance.tudominio.com` (API)
   - `hasura-finance.tudominio.com` (si expones consola, idealmente restringida)
3. Configurar proxy/tls en Nginx Proxy Manager.
4. Ejecutar migraciones antes de levantar versión nueva.
5. Smoke tests post-deploy.

Criterios de aceptación:
- rollback rápido y mínimo downtime.

---

## 7) Integración entre PC y VM

## 7.1 Ciclo recomendado
1. Desarrollar en PC (`finance-system`).
2. Push a GitHub.
3. En VM, pull en `/home/ubuntu/finance-system`.
4. Aplicar migraciones contra DB de staging.
5. Levantar/reiniciar contenedores de finance.
6. Validar logs y health checks.

## 7.2 Comandos de verificación en VM
- Ver stack legacy trading:
```bash
docker compose -f /home/ubuntu/trading-journal/docker-compose.prod.yml ps
```

- Ver stack infra n8n/hasura/postgres:
```bash
docker compose -f /home/ubuntu/n8n/docker-compose.yml ps
```

- Logs Hasura:
```bash
docker compose -f /home/ubuntu/n8n/docker-compose.yml logs -f graphql-engine
```

- Logs Postgres:
```bash
docker compose -f /home/ubuntu/n8n/docker-compose.yml logs -f postgres
```

---

## 8) Decisiones de arquitectura que Codex debe respetar

1. Cero dependencia funcional de trading.
2. Modelo financiero explícito y auditable.
3. Tipos compartidos entre web/api/desktop.
4. Migraciones como fuente de verdad del esquema.
5. Hasura como capa de acceso/consulta, no como sustituto del dominio.
6. n8n para automatización, no para lógica core.
7. Secretos siempre fuera de git.

---

## 9) Prompt maestro para usar con Codex desde tu PC

Copia/pega este prompt al iniciar sesión de trabajo:

```text
Trabaja únicamente en el repositorio finance-system.
Objetivo: construir un sistema financiero/contable completo (web + desktop + API), reutilizando sólo componentes financieros del proyecto legado trading-journal y eliminando por completo cualquier funcionalidad de trading.

Reglas:
1) No usar ni crear features de trading (Binance, órdenes, SL/TP, sesiones de trading, etc.).
2) Mantener secretos fuera de git; usar .env.example para llaves sin valores reales.
3) Proponer y aplicar migraciones SQL versionadas para cada cambio de esquema.
4) Priorizar calidad de dominio contable: cuentas, transacciones, conciliación, presupuestos, deuda, reportes, inversiones.
5) Mantener compatibilidad entre web, desktop y API con tipos compartidos.
6) Antes de cambios grandes, mostrar plan por fases y riesgos.
7) Al final de cada bloque de trabajo: listar archivos cambiados, comandos ejecutados y validaciones realizadas.

Infra real a considerar:
- VM con Postgres + Hasura + NocoDB + n8n.
- Repositorio activo: finance-system.
- Repositorio trading-journal-archive es sólo referencia histórica.

Empieza por:
A) auditar estructura actual,
B) proponer backlog técnico priorizado de Fase 0 y Fase 1,
C) implementar Fase 0 completa con pruebas básicas de arranque local.
```

---

## 10) Prompts por fase (copiar/pegar)

## Fase 0
```text
Ejecuta Fase 0 del runbook: estabilizar bootstrap local de finance-system.
Incluye: scripts de arranque, docker-compose local para Postgres, validación de migraciones y checklist de onboarding.
No avances a Fase 1 sin dejar pruebas de que web/api/desktop levantan.
```

## Fase 1
```text
Ejecuta Fase 1 del runbook: rediseño del modelo contable núcleo y migraciones.
Propón primero el modelo final y luego implementa migraciones + ajustes de API.
Incluye estrategia de migración de datos desde tablas financieras heredadas.
```

## Fase 2
```text
Ejecuta Fase 2 del runbook: API modular y validaciones.
Implementa endpoints por dominio financiero, manejo homogéneo de errores y tests mínimos de integración.
```

## Fase 3
```text
Ejecuta Fase 3 del runbook: interfaz web financiera completa.
Prioriza dashboard, transacciones, conciliación y reportes. Elimina cualquier rastro de componentes de trading.
```

## Fase 4
```text
Ejecuta Fase 4 del runbook: desktop parity.
Define arquitectura desktop y adapta flujos críticos para operar con el backend financiero.
```

## Fase 5
```text
Ejecuta Fase 5 del runbook: asistentes IA financieros.
Conserva el módulo IA, elimina herramientas de trading y agrega capacidades de análisis financiero y presupuestal.
```

## Fase 6-8
```text
Ejecuta Fases 6, 7 y 8 del runbook: Hasura, NocoDB/n8n y despliegue VM.
Entrega metadata versionada, automatizaciones documentadas y playbook de deploy/rollback.
```

---

## 11) Checklist de salida para cada PR

1. ¿Se agregó/actualizó migración SQL?
2. ¿Se actualizó `.env.example` si cambió configuración?
3. ¿Se documentó impacto en `docs/`?
4. ¿Typecheck/build pasan?
5. ¿No hay referencia funcional a trading?
6. ¿Se listaron riesgos y rollback?

---

## 12) Resultado esperado del proyecto

Al finalizar el plan, `finance-system` debe ser:
- producto principal independiente,
- sin acoplamiento a trading,
- con arquitectura mantenible,
- listo para operar en web + desktop + API,
- desplegable en tu VM con prácticas de ingeniería profesionales.
