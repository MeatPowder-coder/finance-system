# Configuracion y finanzas compartidas

## Que se incorporo

FinanceSystem conserva un solo Postgres y separa la informacion por `auth_users.id`.
La nueva capa agrega:

- Un `username` publico y unico por usuario.
- Preferencias de apariencia y configuracion en `auth_users.preferences`.
- Solicitudes de amistad por `username` exacto y relaciones aceptadas mutuamente.
- Invitaciones financieras separadas de la amistad y limitadas a amigos activos.
- Permisos por recurso: `READ`, `WRITE`, `UPLOAD` y `ANALYZE`.
- Grants revocables y una bitacora de auditoria.

La amistad no concede acceso financiero por si sola. La invitacion tampoco activa el acceso inmediatamente: el destinatario debe aceptarla.
Al aceptar, la API crea un grant para cada recurso seleccionado.

## Recursos compartibles

- Cuentas: ver saldo y todos los movimientos relacionados; `WRITE` permite registrar transacciones en esa cuenta.
- Presupuestos, compromisos, proyecciones, deficits y dashboards generados.

Las transacciones no se comparten una por una. El acceso a una cuenta hereda todos sus movimientos para lectura y permite registrar nuevos movimientos cuando se concede `WRITE`. La API vuelve a comprobar el permiso en cada lectura y escritura; nunca se confia en un `owner_user_id` enviado por el cliente.

## Endpoints

- `GET/PATCH /v1/settings/profile`
- `GET/PATCH /v1/settings/preferences`
- `GET /v1/settings/integrations`
- `GET /v1/friends`
- `GET /v1/friends/requests`
- `GET /v1/friends/lookup?username=...` (coincidencia exacta)
- `POST /v1/friends/requests`
- `POST /v1/friends/requests/:id/accept|reject|cancel`
- `DELETE /v1/friends/:id`
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
5. En ambos usuarios, entra a `Configuracion` y define un username distinto.
6. Desde el usuario A, busca el username exacto de B y envia una solicitud de amistad.
7. Desde B, acepta la solicitud; confirma que ambos aparecen en `Amigos`.
8. Desde A, selecciona a B en `Compartir finanzas`, marca una cuenta y permisos, y envia la invitacion.
9. En B, acepta la invitacion y verifica que aparecen la cuenta y sus movimientos relacionados.
10. Para comprobar escritura, concede `Registrar`, entra a `Transacciones`, selecciona la cuenta compartida y crea un movimiento.
11. Elimina la amistad o revoca el grant desde A y verifica que B deja de ver el recurso.

La busqueda no admite coincidencias parciales, nombres ni correos. Las transacciones no aparecen como recursos individuales: se heredan de la cuenta compartida.

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
