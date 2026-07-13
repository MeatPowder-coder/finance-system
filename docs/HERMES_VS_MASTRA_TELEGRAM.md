# Hermes vs Mastra para Telegram en Finance System

## Decisión corta

La opción más sana para este proyecto es:

- **Hermes** como la capa visible de Telegram.
- **Mastra** como el cerebro agéntico y financiero dentro de `finance-system`.
- **finance-system** como la fuente de verdad de cuentas, presupuestos, transacciones, proyecciones y recordatorios.

En otras palabras:

- si la conversación ocurre en Telegram, **Hermes** debería hablar con el usuario;
- si la acción financiera real ocurre en el sistema, **Mastra + finance-system** deben ejecutarla.

## Por qué no conviene tener dos Telegram a la vez

Tener Telegram duplicado en dos sitios suele terminar mal:

- dos bots o dos flujos distintos para lo mismo;
- comandos diferentes según dónde cayó el mensaje;
- doble lógica para recordatorios, aprobaciones y propuestas;
- más fricción al depurar errores;
- más difícil mantener la paridad entre VM, PC y despliegue.

Si Hermes ya funciona bien en Telegram, lo mejor es que sea la **única puerta de entrada Telegram**.

## Rol de cada pieza

### Hermes

Hermes debería ser la interfaz conversacional de Telegram.

Usos ideales:

- recibir mensajes de Telegram;
- responder por Telegram con lenguaje natural;
- mostrar resúmenes, alertas y propuestas;
- actuar como “front door” del chat;
- manejar UX de Telegram, comandos y notificaciones.

### Mastra

Mastra debería quedarse como el motor agéntico interno de `finance-system`.

Usos ideales:

- decidir qué hacer con un pedido financiero;
- analizar contexto de cuentas, presupuestos y transacciones;
- generar propuestas;
- crear recordatorios;
- sugerir dashboards o proyecciones;
- orquestar herramientas y reglas internas.

### finance-system

`finance-system` debería ser la fuente de verdad.

Usos ideales:

- guardar datos financieros;
- exponer API para Hermes y para la web/desktop;
- aplicar reglas de negocio;
- persistir propuestas, déficits, presupuestos y recordatorios;
- servir de backend confiable para todo canal.

## Cómo se conectarían Hermes y finance-system

La forma más limpia es que Hermes llame a `finance-system` por HTTP.

Flujo recomendado:

1. El usuario escribe en Telegram.
2. Hermes recibe el mensaje.
3. Hermes decide si el mensaje necesita consulta financiera, alerta o acción.
4. Hermes llama a `finance-system`:
   - para leer datos;
   - para pedir una respuesta agéntica;
   - para crear una propuesta;
   - para registrar un recordatorio.
5. `finance-system` procesa con Mastra y devuelve la decisión.
6. Hermes responde al usuario en Telegram.

## Contrato sugerido entre Hermes y finance-system

Hermes no debería “saber” la lógica interna de la base de datos.
Lo ideal es que use una API simple y estable.

Endpoints útiles:

- `POST /v1/agents/chat`
- `GET /v1/agent-proposals`
- `POST /v1/agent-proposals/:id/approve`
- `POST /v1/agent-proposals/:id/reject`
- `GET /v1/reminders`
- `POST /v1/reminders`
- `POST /v1/reminders/:id/trigger`
- `GET /v1/dashboard/home`

Si más adelante quieres algo más formal, también se puede poner un contrato tipo MCP o webhooks dedicados para herramientas.

## Por qué tiene sentido hacerlo así

### 1. Separación clara de responsabilidades

Hermes se encarga de Telegram.
Mastra se encarga de pensar.
finance-system se encarga de guardar y ejecutar.

Eso hace el sistema más fácil de mantener.

### 2. Mejor experiencia para Telegram

Telegram funciona mejor cuando el bot tiene una personalidad y un flujo propios.
Hermes puede concentrarse en eso sin arrastrar la complejidad completa de la app financiera.

### 3. Menos duplicación

Si finance-system también “habla Telegram”, acabas con dos superficies casi iguales.
Eso duplica mantenimiento y confunde el flujo de usuario.

### 4. Más fácil de desplegar en la VM

La VM puede tener:

- `finance-system`
- `Hermes`
- PostgreSQL / Hasura / lo que corresponda

Cada servicio con su responsabilidad.

## Qué recomiendo hacer con Telegram en finance-system

Si Hermes se queda como la capa de Telegram, lo recomendable es:

- retirar la integración Telegram directa de `finance-system`;
- dejar `finance-system` solo con APIs agénticas y financieras;
- hacer que Hermes use esas APIs;
- mantener un único punto de entrada en Telegram.

Esto reduce deuda técnica y evita que Telegram quede repartido entre dos bots o dos UIs.

## Cuándo sí tendría sentido dejar Telegram dentro de finance-system

Solo lo dejaría si quisieras que:

- el mismo repo sea dueño absoluto del bot;
- no haya ningún servicio intermedio;
- prefieras menos piezas aunque el código sea más pesado.

Pero con Hermes ya funcionando bien, esa opción pierde valor.

## Recomendación final

La mejor estrategia para este proyecto es:

- **Telegram = Hermes**
- **agente financiero = Mastra dentro de finance-system**
- **datos y reglas = finance-system**

Así tienes:

- una sola experiencia de chat;
- una sola fuente de verdad;
- menos duplicación;
- mejor mantenibilidad;
- más claridad para la VM y para el futuro despliegue.

## Siguiente paso sugerido

Si adoptamos Hermes como canal oficial de Telegram, el siguiente movimiento lógico es:

1. desactivar o retirar la capa Telegram duplicada de `finance-system`;
2. documentar el contrato Hermes ↔ finance-system;
3. dejar que Hermes sea el único bot conversacional en Telegram;
4. mantener Mastra únicamente como runtime agéntico interno.

