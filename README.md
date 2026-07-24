# LYSTO — Bot de pedidos por WhatsApp

Este servidor conecta WhatsApp (API oficial de Meta, gratis) con Claude para ordenar
pedidos automáticamente, usando las mismas listas de precios y base de clientes
que ya probaste en el chat.

## Qué incluye
- `server.js` — el servidor (recibe mensajes de WhatsApp, los manda a Claude, responde).
- `data/priceLists.json` — las 5 listas de precios (editable).
- `data/clients.json` — los 48 clientes con teléfono, email y tipo de entrega (editable).
- `data/conversations.json` — se genera solo; guarda el historial de cada conversación para que las preguntas de aclaración funcionen.

---

## PASO 1 — Crear la app en Meta for Developers

1. Entrá a https://developers.facebook.com/ y creá una cuenta de desarrollador si no tenés.
2. "Mis apps" → "Crear app" → elegí tipo **"Empresa"** (Business).
3. Dentro de la app, buscá el producto **WhatsApp** y hacé clic en "Configurar".
4. Meta te va a dar automáticamente:
   - Un **número de prueba de WhatsApp** (podés mandar mensajes de prueba a hasta 5 números verificados).
   - Un **Access Token temporal** (dura 24hs — más abajo te explico cómo generar uno permanente).
   - El **Phone Number ID** (un ID numérico, no es el número de teléfono en sí).
5. Guardá esos 3 datos, los vas a necesitar en el Paso 3.

> Nota: mientras uses el número de prueba, solo podés escribirle a números que agregues manualmente en "Números de teléfono destinatarios". Para pasar a producción con tu propio número de WhatsApp Business real, hay que verificar el negocio ante Meta (es otro trámite, te ayudo cuando llegue el momento).

## PASO 2 — Generar un token permanente (opcional pero recomendado)

El token temporal expira en 24hs. Para uno de larga duración:
1. En tu app de Meta → "Configuración" → "Usuarios del sistema" → creá un usuario del sistema.
2. Asignale el activo (la app de WhatsApp) con permiso `whatsapp_business_messaging`.
3. Generá un token para ese usuario del sistema, sin fecha de expiración.

## PASO 3 — Subir el código a Railway

1. Entrá a https://railway.app/ y creá una cuenta (podés usar GitHub).
2. Necesitás subir esta carpeta a un repositorio de GitHub primero:
   - Creá un repo nuevo en GitHub (puede ser privado).
   - Subí todos estos archivos (server.js, package.json, data/, README.md) — **no subas el archivo `.env`**, solo `.env.example`.
3. En Railway: "New Project" → "Deploy from GitHub repo" → elegí el repo.
4. Railway va a detectar que es Node.js y va a correr `npm install` y `npm start` solo.
5. Andá a la pestaña **"Variables"** del proyecto en Railway y cargá:
   - `WHATSAPP_TOKEN` → el token del Paso 1 o 2.
   - `PHONE_NUMBER_ID` → el ID del Paso 1.
   - `VERIFY_TOKEN` → inventá una palabra (ej: `lysto2026`), la vas a repetir en el Paso 4.
   - `ANTHROPIC_API_KEY` → tu API key de https://console.anthropic.com/settings/keys
6. Railway te va a dar una URL pública tipo `https://tu-proyecto.up.railway.app`.

## PASO 4 — Conectar el Webhook en Meta

1. Volvé a tu app en Meta for Developers → WhatsApp → Configuración.
2. En "Webhook", hacé clic en "Editar":
   - **URL de retorno de llamada**: `https://tu-proyecto.up.railway.app/webhook`
   - **Verificar token**: el mismo valor que pusiste en `VERIFY_TOKEN` en Railway.
3. Guardar y verificar (Meta le va a pegar un GET a tu servidor automáticamente; si todo está bien, se marca como verificado en verde).
4. Suscribite al campo **"messages"** para que te lleguen los mensajes entrantes.

## PASO 5 — Probar

1. Desde uno de los números autorizados (Paso 1), mandale un WhatsApp al número de prueba con un pedido, por ejemplo:
   > hola juan mandame 3 cajas de clasicas y 2 de premium 8x8 para once tipos, lista B
2. El bot te va a responder solo, preguntando si falta algo o directamente con el pedido armado.
3. Para arrancar un pedido nuevo sin arrastrar el anterior, mandá la palabra **"nuevo pedido"**.

---

## Cómo modificar esto más adelante

Cualquier cambio (agregar un producto, ajustar precios, cambiar cómo pregunta, agregar clientes)
lo pedís en el chat de Claude donde armamos esto. Te voy a devolver el archivo actualizado
(`server.js` y/o los `.json` de `data/`) — solo tenés que:
1. Reemplazar el archivo en tu repo de GitHub (subir el archivo nuevo).
2. Railway detecta el cambio en GitHub y redeploya solo, en 1-2 minutos.

No hace falta tocar nada en Meta ni en Railway salvo que cambien las variables de entorno.
