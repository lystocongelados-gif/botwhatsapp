require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ---------- Configuración ----------
const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-2.0-flash',
  PORT = 3000
} = process.env;

const PRICE_LISTS_PATH = path.join(__dirname, 'data', 'priceLists.json');
const CLIENTS_PATH = path.join(__dirname, 'data', 'clients.json');

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

const priceLists = loadJson(PRICE_LISTS_PATH, {});
const clients = loadJson(CLIENTS_PATH, []);

// ---------- Prompt del sistema (misma lógica que la versión de chat) ----------
function buildSystemPrompt() {
  return `Sos un asistente que ordena pedidos de LYSTO CONGELADOS, una fábrica de papas prefritas congeladas en Tucumán, Argentina.

Recibís mensajes de WhatsApp desordenados, con errores de tipeo, abreviaciones o jerga informal, y tenés que devolver el pedido interpretado en formato JSON estricto.

LISTAS DE PRECIOS DISPONIBLES (elegí la que corresponda según lo que diga el mensaje; si no queda claro, preguntá):
${JSON.stringify(priceLists, null, 2)}

Cada producto tiene precio "neto_2_5kg" (precio de una unidad de 2,5kg) y "caja_x6" (precio de la caja que trae 6 unidades de 2,5kg). Si el pedido menciona "cajas", usá caja_x6. Si menciona "kilos" o unidades sueltas de 2,5kg, usá neto_2_5kg y multiplicá por la cantidad de unidades de 2,5kg correspondientes.

Nombres de productos (usalos EXACTAMENTE así en la salida, mapeando sinónimos como "clásicas"/"clasicas", "premium"/"crocante premium 8x8", "10x10"/"trad"/"tradicional" a estos):
- "Clásicas 8x8mm"
- "Crocante Premium 8x8mm"
- "Crocante Premium trad 10x10mm"

BASE DE CLIENTES (para matchear el nombre/alias que aparezca en el mensaje, aunque esté mal escrito o incompleto). Cada cliente tiene "tipo_entrega" por defecto: "flete_interno", "retira_fabrica" o "flete_externo":
${JSON.stringify(clients, null, 2)}

INSTRUCCIONES:
1. Identificá el cliente mencionado en el mensaje y buscá el mejor match en la base (por nombre, apodo, o parte del nombre).
2. Identificá qué lista de precios corresponde (A = "Gastronomico A", B = "Gastronomico B", C = "Gastronomico C", "mayorista" = "Mayorista", "distribuidor" = "Distribuidor").
3. Extraé cada producto pedido con su cantidad y calculá el precio unitario y subtotal según la lista.
4. Sumá el total general.
5. Determiná el tipo de entrega: "flete_interno", "retira_fabrica" o "flete_externo". Usá como base el campo "tipo_entrega" del cliente. Si el mensaje menciona explícitamente algo distinto para este pedido, priorizá el mensaje y aclaralo en notas. Si no hay dato ni se menciona, dejalo en null y avisá en advertencias que falta confirmar.
6. Notas adicionales relevantes (fecha de entrega, forma de pago, aclaraciones) van en "notas" (string, puede ser vacío).

CONVERSACIÓN, NO ADIVINANZA:
Este es un chat de varios turnos. Si para armar el pedido completo falta un dato IMPRESCINDIBLE (no identificás el cliente con confianza razonable, no sabés qué lista de precios usar, o no queda claro qué producto/cantidad pidieron), NO inventes ni asumas: respondé con estado "faltan_datos" y una pregunta corta y concreta (una sola pregunta a la vez, la más urgente primero). Cuando el usuario responda en el siguiente mensaje, usá esa respuesta junto con el historial completo para completar el pedido.

Caso especial de ambigüedad de producto: "Clásicas 8x8mm" y "Crocante Premium 8x8mm" comparten el corte (8x8mm). Si el mensaje solo dice "8mm"/"8x8"/"8x8mm" sin decir "clásica" o "premium"/"crocante", preguntá específicamente cuál de los dos es. En cambio "10x10"/"trad"/"tradicional" no es ambiguo, siempre es "Crocante Premium trad 10x10mm".

Solo devolvés estado "completo" cuando tenés cliente, lista de precios y al menos un producto con cantidad, todos con confianza razonable. Detalles menores (ej: falta el teléfono guardado) van como advertencias dentro de un pedido "completo", no como pregunta.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks, con una de estas dos formas exactas:

Si falta un dato imprescindible:
{
  "estado": "faltan_datos",
  "pregunta": string
}

Si el pedido está completo:
{
  "estado": "completo",
  "cliente": {"nombre_detectado": string, "match": string|null, "telefono": string|null, "email": string|null, "confianza": "alta"|"media"|"baja"|"sin_match"},
  "lista_precio": string|null,
  "entrega": "flete_interno"|"retira_fabrica"|"flete_externo"|null,
  "items": [{"producto": string, "cantidad": number, "unidad": "cajas"|"unidades de 2.5kg", "precio_unitario": number, "subtotal": number}],
  "total": number,
  "advertencias": [string],
  "notas": string
}`;
}

function money(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function entregaLabel(e) {
  return { flete_interno: 'Flete interno', retira_fabrica: 'Retira de fábrica', flete_externo: 'Flete externo' }[e] || null;
}

function buildOrderText(order) {
  const lines = [];
  const cli = (order.cliente && (order.cliente.match || order.cliente.nombre_detectado)) || 'Cliente';
  lines.push(`*Pedido — ${cli}*`);
  if (order.lista_precio) lines.push(`Lista: ${order.lista_precio}`);
  const entregaTxt = entregaLabel(order.entrega);
  if (entregaTxt) lines.push(`Entrega: ${entregaTxt}`);
  lines.push('');
  (order.items || []).forEach(it => {
    const unidad = it.unidad === 'cajas' ? 'caja(s)' : 'unidad(es) 2,5kg';
    lines.push(`• ${it.cantidad} ${unidad} — ${it.producto} — ${money(it.precio_unitario)} c/u — ${money(it.subtotal)}`);
  });
  lines.push('');
  lines.push(`*TOTAL: ${money(order.total || 0)}*`);
  if (order.advertencias && order.advertencias.length) {
    lines.push('');
    lines.push(`⚠️ ${order.advertencias.join(' · ')}`);
  }
  if (order.notas) {
    lines.push('');
    lines.push(order.notas);
  }
  return lines.join('\n');
}

// ---------- Llamada a la API de Gemini (capa gratuita) ----------
async function askLLM(messages) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt() }] },
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        responseMimeType: 'application/json'
      }
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Error de la API de Gemini');
  }
  const candidate = data.candidates && data.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  let raw = parts.map(p => p.text || '').join('\n').trim();
  raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  if (!raw) {
    throw new Error('Respuesta vacía del modelo (posible corte por finishReason: ' + (candidate && candidate.finishReason) + ')');
  }
  return { parsed: JSON.parse(raw), rawText: raw };
}

// ---------- Página web /pedidos ----------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/pedidos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pedidos.html'));
});

// ---------- API usada por la página web ----------
app.post('/api/order', async (req, res) => {
  const messages = req.body && Array.isArray(req.body.messages) ? req.body.messages : null;

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'Falta el mensaje del pedido.' });
  }

  try {
    const { parsed, rawText } = await askLLM(messages);

    if (parsed.estado === 'faltan_datos') {
      return res.json({ estado: 'faltan_datos', pregunta: parsed.pregunta, rawText });
    }

    return res.json({ estado: 'completo', pedido: parsed, texto: buildOrderText(parsed), rawText });
  } catch (err) {
    console.error('Error en /api/order:', err);
    return res.status(502).json({ error: 'No pudimos procesar el pedido. Probá de nuevo en unos segundos.' });
  }
});

// ---------- Endpoint de salud (para chequear que el servidor está vivo) ----------
app.get('/', (req, res) => {
  res.redirect('/pedidos');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
