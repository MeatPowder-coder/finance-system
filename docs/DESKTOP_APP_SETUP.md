# Desktop App Setup

## Dónde se desarrolla

- La app desktop se desarrolla en tu PC.
- La VM se usa como backend productivo: API, base de datos, Hasura, web pública y servicios auxiliares.
- No hace falta editar código dentro de la VM salvo tareas puntuales de despliegue o inspección.

## Cómo se conecta al backend de la VM

- La desktop lee su backend desde `NEXT_PUBLIC_API_BASE_URL` o `VITE_API_BASE_URL`.
- En local apunta a `http://localhost:4100`.
- Para probar contra la VM, apunta a algo como `https://api.tu-dominio.com`.
- Si más adelante guardas un token de acceso, la app lo enviará en `Authorization: Bearer ...`.

## Flujo recomendado

1. Desarrolla y prueba primero en tu PC.
2. Levanta la API local cuando quieras validar cambios sin tocar la VM.
3. Cambia la URL del backend al endpoint de la VM cuando quieras probar datos reales.
4. Cuando el flujo esté estable, publica la build desktop desde GitHub Releases.

## Comandos útiles

- `pnpm dev:desktop` para ver la versión Vite en navegador.
- `pnpm dev:desktop:tauri` para abrir la app desktop real.
- `pnpm build:desktop:tauri` para generar el instalador.

## Publicación

- El workflow `Desktop Release` se dispara con tags tipo `desktop-v1.0.0`.
- Ese flujo construye la desktop y publica el bundle en GitHub Releases.
- La idea es que el instalador salga de ahí, no de una copia manual en la VM.

## Notas

- La desktop no debe clonarse como `iframe`; debe empaquetar la misma UI dentro de Tauri.
- La VM sigue siendo la fuente de verdad para datos, agentes y automatizaciones.
