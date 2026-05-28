# Plan de Migracion desde Trading Journal

## Estado actual

El repositorio `finance-system` ya no esta en modo scaffold vacio:

- Tiene API funcional para cuentas/transacciones/resumen.
- Tiene web y desktop consumiendo la API.
- Tiene migracion de puente para importar `cuentas` y `transacciones` legacy.

## Reutilizacion aplicada

### Datos

- `cuentas` (legacy) -> `accounts` (nuevo modelo)
- `transacciones` (legacy) -> `transactions` (nuevo modelo)

La importacion se hace en `db/migrations/002_legacy_finance_bridge.sql`.

### Decisiones de mapeo

- Tipos de cuenta legacy como `AHORROS`, `CORRIENTE`, `TARJETA_CREDITO` se normalizan a:
  - `SAVINGS`, `CHECKING`, `CREDIT_CARD`, etc.
- Direccion de transaccion se normaliza a `INFLOW` y `OUTFLOW`.
- Estado de transaccion legacy se normaliza a:
  - `PENDING`, `POSTED`, `RECONCILED`, `VOID`.

## Que NO se migra

- Tablas y workflows de trading (`trades_activos`, `pending_limit_orders`, etc.)
- Endpoints Binance y protecciones SL/TP
- UI de dashboard de trading

## Orden recomendado de ejecucion

1. Ejecutar `001_finance_core.sql`
2. Ejecutar `002_legacy_finance_bridge.sql`
3. Validar conteos:
   - numero de cuentas importadas
   - numero de transacciones importadas
4. Arrancar API y frontend para revisar saldos y movimientos

## Consultas de validacion rapida

```sql
SELECT COUNT(*) FROM accounts;
SELECT COUNT(*) FROM transactions;
SELECT account_type, COUNT(*) FROM accounts GROUP BY account_type ORDER BY 2 DESC;
SELECT direction, COUNT(*) FROM transactions GROUP BY direction ORDER BY 2 DESC;
```
