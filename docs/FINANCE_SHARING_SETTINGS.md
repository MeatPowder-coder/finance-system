# Configuracion y finanzas compartidas

## Que se incorporo

FinanceSystem conserva un solo Postgres y separa la informacion por `auth_users.id`.
La nueva capa agrega:

- Un `username` publico y unico por usuario.
- Preferencias de apariencia y configuracion en `auth_users.preferences`.
- Invitaciones dirigidas por nombre de usuario.
- Permisos por recurso: `READ`, `WRITE`, `UPLOAD` y `ANALYZE`.
- Grants revocables y una bitacora de auditoria.

La invitacion no activa el acceso inmediatamente. El destinatario debe aceptarla.
Al aceptar, la API crea un grant para cada recurso seleccionado.

## Recursos compartibles

- Cuentas: ver saldo y movimientos relacionados; `WRITE` permite registrar transacciones en esa cuenta.
- Movimientos: acceso directo a transacciones concretas.
- Presupuestos, compromisos, proyecciones, deficits y dashboards generados.

El acceso a una cuenta hereda sus transacciones para lectura. La API vuelve a comprobar el permiso en cada lectura y escritura; nunca se confia en un `owner_user_id` enviado por el cliente.

## Endpoints

- `GET/PATCH /v1/settings/profile`
- `GET/PATCH /v1/settings/preferences`
- `GET /v1/settings/integrations`
- `GET /v1/shares/users?q=...`
- `GET /v1/shares/catalog`
- `GET /v1/shares`
- `POST /v1/shares/invitations`
- `POST /v1/shares/invitations/:id/accept`
- `POST /v1/shares/invitations/:id/reject`
- `POST /v1/shares/invitations/:id/revoke`
- `PATCH/DELETE /v1/shares/grants/:id`

## Prueba local

1. Inicia Docker Desktop y confirma que el contenedor local de Postgres este activo.
2. Ejecuta `pnpm db:migrate`. El script local prioriza `.env.local`; el despliegue de VM usa `.env.vm`.
3. Arranca la API y web con `pnpm dev:api` y `pnpm dev:web`.
4. Registra dos usuarios desde `/` usando Google o correo y contrasena.
5. En el usuario propietario, entra a `Configuracion`, define tu username, selecciona recursos y envia una invitacion.
6. En el segundo usuario, entra a `Configuracion`, acepta la invitacion y verifica que aparecen las cuentas compartidas.
7. Para comprobar escritura, concede `Registrar`, entra a `Transacciones`, selecciona la cuenta compartida y crea un movimiento.
8. Revoca el grant desde el propietario y verifica que el segundo usuario deja de ver el recurso.

## Despliegue en VM

El orden seguro es:

1. Hacer backup de Postgres.
2. Actualizar el repositorio en la VM.
3. Ejecutar `pnpm install --frozen-lockfile`.
4. Ejecutar `pnpm db:migrate` con el `.env.vm` de la VM.
5. Aplicar metadata Hasura cuando las migraciones terminen.
6. Recrear API, web y worker con `docker compose -f docker-compose.vm.yml --env-file .env.vm up -d --build`.
7. Probar `health`, login, configuracion, invitacion, aceptacion y revocacion.

No se crean Postgres ni Hasura por usuario. El aislamiento depende de la API, los grants y las restricciones de propietario; por eso no se deben exponer escrituras directas de Hasura para esta funcionalidad hasta tener una politica equivalente de grants.
