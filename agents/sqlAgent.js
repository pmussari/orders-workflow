const { callOllama } = require('./ollama')

const SCHEMA = `Tablas disponibles:
  orders(id, identifier, chat_id, status, created_at)   -- status: active|cancelled|completed
  order_items(id, order_id, name, quantity)`

const SYSTEM_PROMPT = `Eres un generador de acciones para un sistema de pedidos.
Se te proporciona la intención ya clasificada y las entidades extraídas. Tu único trabajo es traducirlas a la acción JSON correcta.
Responde SOLO con JSON válido, sin texto adicional.

${SCHEMA}

Formato de respuesta: {"action":"ACCION","params":{},"message":"respuesta en español"}

Acciones y params:
- query:          {"sql":"SELECT ... WHERE o.chat_id = ? ..."}  ← usa ? para chat_id (siempre primer parámetro)
- create_order:   {"items":[{"name":"...","quantity":N}]}
- cancel_order:   {"identifier":"ORDEN-XXX"}
- complete_order: {"identifier":"ORDEN-XXX"}
- add_item:       {"identifier":"ORDEN-XXX","name":"...","quantity":N}
- remove_item:    {"identifier":"ORDEN-XXX","name":"..."}
- modify_item:    {"identifier":"ORDEN-XXX","name":"...","quantity":N}
- none:           {}`

const FEW_SHOTS = [
  {
    role: 'user',
    content: 'intent: query_orders | entities: {"status":"active","item":null} | message: "Cuales son mis ordenes activas?"',
  },
  {
    role: 'assistant',
    content: '{"action":"query","params":{"sql":"SELECT o.identifier, o.status, oi.name, oi.quantity FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.chat_id = ? AND o.status = \'active\' ORDER BY o.id DESC"},"message":"Aquí están tus pedidos activos."}',
  },
  {
    role: 'user',
    content: 'intent: query_orders | entities: {"status":null,"item":"Coca Cola"} | message: "Tengo ordenes con Coca Cola?"',
  },
  {
    role: 'assistant',
    content: '{"action":"query","params":{"sql":"SELECT o.identifier, o.status, oi.name, oi.quantity FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.chat_id = ? AND LOWER(oi.name) LIKE \'%coca cola%\'"},"message":"Aquí están los pedidos que contienen Coca Cola."}',
  },
  {
    role: 'user',
    content: 'intent: query_orders | entities: {"status":null,"item":null} | message: "Cuales son mis pedidos?"',
  },
  {
    role: 'assistant',
    content: '{"action":"query","params":{"sql":"SELECT o.identifier, o.status, oi.name, oi.quantity FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.chat_id = ? ORDER BY o.id DESC"},"message":"Aquí están todos tus pedidos."}',
  },
  {
    role: 'user',
    content: 'intent: create_order | entities: {"items":[{"name":"pizza","quantity":2},{"name":"coca cola","quantity":1}]} | message: "Quiero 2 pizzas y 1 coca cola"',
  },
  {
    role: 'assistant',
    content: '{"action":"create_order","params":{"items":[{"name":"pizza","quantity":2},{"name":"coca cola","quantity":1}]},"message":"¡Orden creada exitosamente!"}',
  },
  {
    role: 'user',
    content: 'intent: cancel_order | entities: {"identifier":"ORDEN-001"} | message: "Cancela la orden 1"',
  },
  {
    role: 'assistant',
    content: '{"action":"cancel_order","params":{"identifier":"ORDEN-001"},"message":"La orden ORDEN-001 ha sido cancelada."}',
  },
  {
    role: 'user',
    content: 'intent: none | entities: {} | message: "Hola"',
  },
  {
    role: 'assistant',
    content: '{"action":"none","params":{},"message":"¡Hola! ¿En qué puedo ayudarte con tu pedido?"}',
  },
]

function extractJson(text) {
  let start = text.indexOf('{')
  while (start !== -1) {
    let depth = 0, end = -1
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1))
        if (parsed.action) return parsed
      } catch {}
    }
    start = text.indexOf('{', start + 1)
  }
  return null
}

async function generateAction(intent, entities, userText, chatId, config, getCustomerContext) {
  const customerContext = getCustomerContext()
  const userMessage = `intent: ${intent} | entities: ${JSON.stringify(entities)} | message: "${userText}"`

  const systemWithContext = `${SYSTEM_PROMPT}

PEDIDOS DEL CLIENTE:
${customerContext}`

  const messages = [
    { role: 'system', content: systemWithContext },
    ...FEW_SHOTS,
    { role: 'user', content: userMessage },
  ]

  const raw = await callOllama(messages, config)
  console.log(`[sqlAgent raw] ${raw}`)

  const parsed = extractJson(raw)
  if (!parsed) {
    console.warn('[sqlAgent] could not parse response:', raw)
    return { action: 'none', params: {}, message: 'No pude procesar tu solicitud. Por favor intenta de nuevo.' }
  }
  return parsed
}

module.exports = { generateAction }
