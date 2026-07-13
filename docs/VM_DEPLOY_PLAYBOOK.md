# VM Deploy Playbook (Fase 8)

## 1) Preparacion

1. Copiar `.env.vm.example` a `.env.vm` y completar secretos.
2. Validar que exista red externa `infra-net`:

```bash
docker network ls | grep infra-net
```

## 2) Backup antes de despliegue

```bash
pg_dump -h servidor-db -U root -d finanzas -Fc -f /backups/finanzas_pre_deploy.dump
```

## 3) Despliegue

Si quieres hacerlo de una sola vez:

```bash
pnpm vm:deploy
```

Si prefieres los pasos manuales:

```bash
git pull --ff-only origin main
pnpm install
pnpm db:migrate
pnpm hasura:apply
pnpm vm:up
pnpm vm:ps
```

## 4) Smoke tests

1. `GET /health` API:

```bash
curl -s https://api-finance.tudominio.com/health
```

2. Configuracion de auth:

```bash
curl -s https://api-finance.tudominio.com/v1/auth/config
```

3. Login con correo y contrasena:

```bash
curl -X POST https://api-finance.tudominio.com/v1/auth/email/login -H "Content-Type: application/json" -d "{\"email\":\"tu-correo@ejemplo.com\",\"password\":\"tu-clave\"}"
```

4. Login con Google:

   - Abrir `https://finance.tudominio.com/?auth=login`
   - En Google Cloud Console registrar como redirect URI:
     - `https://finance.tudominio.com/auth/callback`
     - `http://localhost:3005/auth/callback` para pruebas locales
     - `http://127.0.0.1:1420/auth/callback` para desktop en desarrollo
   - Confirmar que el boton de Google abre el flujo y regresa a la app

5. Web:
   - Abrir `https://finance.tudominio.com`

## 5) Rollback

1. Bajar servicios nuevos:

```bash
pnpm vm:down
```

2. Restaurar DB:

```bash
pg_restore -h servidor-db -U root -d finanzas --clean --if-exists --no-owner --no-privileges /backups/finanzas_pre_deploy.dump
```

3. Levantar version estable previa.
