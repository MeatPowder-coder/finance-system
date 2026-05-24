# Arquitectura Inicial

## Capas

- `apps/web`: experiencia principal de usuario
- `apps/api`: lógica de dominio y acceso a PostgreSQL
- `apps/desktop`: shell/app nativa para operación en escritorio
- `packages/shared`: contratos de tipos

## Dominios V1

1. Accounts
2. Transactions
3. Budgets
4. Recurring
5. Debt/Credit cards
6. Reports

## Principios

- Sin lógica de trading ni dependencias a Binance
- Tipos compartidos entre web/api/desktop
- Dominio contable explícito (ingresos/egresos, categorías, conciliación)
