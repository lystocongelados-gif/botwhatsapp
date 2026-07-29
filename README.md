# LYSTO — Pedidos web

Página web (`/pedidos`) que arma pedidos de LYSTO Congelados a partir de un
mensaje en lenguaje natural, usando Claude para interpretarlo contra la lista
de precios y la base de clientes.

## Qué incluye
- `server.js` — servidor Express: sirve `/pedidos` y expone `POST /api/order`.
- `public/pedidos.html` — el frontend (chat simple, pensado para mobile).
- `data/priceLists.json` — las 5 listas de precios (editable).
- `data/clients.json` — la base de clientes con teléfono, email, lista de precios y tipo de entrega (editable).

## Variables de entorno
Solo hace falta una, cargada en Railway → pestaña "Variables":
- `ANTHROPIC_API_KEY` → tu API key de https://console.anthropic.com/settings/keys

`PORT` la asigna Railway solo, no hace falta tocarla.

## Cómo correr localmente
```
npm install
ANTHROPIC_API_KEY=tu_key npm start
```
Después abrí `http://localhost:3000/pedidos`.

## Cómo se actualiza en producción
Cualquier cambio (agregar un producto, ajustar precios, agregar clientes, tocar
el diseño de la página) se pide en el chat de Claude donde se armó esto.
Una vez que el archivo cambia:
1. Se hace commit y push al repo de GitHub.
2. Railway detecta el cambio y redeploya solo, en 1-2 minutos.

No hace falta tocar nada en Railway salvo que cambie `ANTHROPIC_API_KEY`.
