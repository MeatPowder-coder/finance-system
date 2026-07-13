# Desktop-Web Parity Spec (Tauri)

Objetivo: la app desktop debe verse y comportarse igual que web.

## 1) Paridad visual obligatoria

- Misma navegacion lateral y tabs.
- Mismos tokens de color, espaciado y tipografia.
- Misma estructura de cards, tablas, filtros, formularios y estados.
- Mismo comportamiento responsive en resoluciones desktop comunes.

## 2) Paridad funcional obligatoria

- Dashboard: mismas metricas y resumenes.
- Cuentas: misma tabla y lecturas.
- Transacciones: mismos filtros basicos y columnas.
- Reportes: mismo rango, resumen y exportacion.
- Portfolio/Inversiones: misma vista y calculos expuestos por API.
- Copilot: misma experiencia de chat (no solo listado de sesiones).
- Dashboards IA: mismas vistas generadas y estados DRAFT/PUBLISHED.
- Propuestas: aprobacion/rechazo desde desktop.
- Recordatorios: listado y pausa desde desktop.

## 3) Contrato de API unico

Desktop y web deben usar el mismo cliente y los mismos endpoints:

- `/v1/summary`
- `/v1/accounts`
- `/v1/transactions`
- `/v1/reports/*`
- `/v1/investments`
- `/v1/copilot/*`
- `/v1/agents/*`
- `/v1/generated-views`
- `/v1/reminders`

## 4) Criterios de aceptacion

- No existe una UI simplificada exclusiva de desktop.
- Cualquier feature visible en web debe existir en desktop, salvo restricciones explicitas de plataforma.
- Capturas comparativas web vs desktop por modulo muestran paridad visual y de datos.
- Build Tauri genera app instalable funcional sin depender de abrir la web.
