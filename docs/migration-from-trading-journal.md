# Plan de Migración desde Trading Journal

## Reutilizar

- Tabla `cuentas` -> `accounts`
- Tabla `transacciones` -> `transactions`
- Vistas de saldos agrupados como referencia para dashboards
- Modo IA contador (sin herramientas de trading)

## No migrar

- `trades_activos`, `pending_limit_orders`, `trading_sessions`
- Endpoints `api/binance/*`, `api/trades/*`, `api/orders/*`
- Módulos de riesgo SL/TP y disciplina de trading

## Estrategia

1. Exportar datos financieros del sistema actual
2. Transformar al nuevo modelo (code/account_type/direction)
3. Importar en DB nueva
4. Validar saldos y conteos
