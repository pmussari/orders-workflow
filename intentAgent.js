const { callOllama } = require('./ollama')

const SYSTEM_PROMPT = `Eres un clasificador de intenciones para un bot de pedidos.
Analiza el mensaje y responde SOLO con JSON válido, sin texto adicional.

Formato: {"intent":"...","entities":{...}}

Intenciones válidas y sus entities:
- create_order:   {"items":[{"name":"...","quantity":N}]}
- add_item:       {"identifier":"ORDEN-XXX|null","name":"...","quantity":N}
- remove_item:    {"identifier":"ORDEN-XXX|null","name":"..."}
- modify_item:    {"identifier":"ORDEN-XXX|null","name":"...","quantity":N}
- cancel_order:   {"identifier":"ORDEN-XXX|null"}
- complete_order: {"identifier":"ORDEN-XXX|null"}
- query_orders:   {"status":"active|cancelled|completed|null","item":"nombre|null"}
- none:           {}`

const FEW_SHOTS = [
  { role: 'user', content: 'Quiero crear una orden con 2 pizzas y 1 coca cola' },
  { role: 'assistant', content: '{"intent":"create_order","entities":{"items":[{"name":"pizza","quantity":2},{"name":"coca cola","quantity":1}]}}' },
  { role: 'user', content: 'Cuales son mis ordenes activas?' },
  { role: 'assistant', content: '{"intent":"query_orders","entities":{"status":"active","item":null}}' },
  { role: 'user', content: 'Tengo ordenes con Coca Cola?' },
  { role: 'assistant', content: '{"intent":"query_orders","entities":{"status":null,"item":"Coca Cola"}}' },
  { role: 'user', content: 'Cuales son mis pedidos?' },
  { role: 'assistant', content: '{"intent":"query_orders","entities":{"status":null,"item":null}}' },
  { role: 'user', content: 'Cancela la orden 1' },
  { role: 'assistant', content: '{"intent":"cancel_order","entities":{"identifier":"ORDEN-001"}}' },
  { role: 'user', content: 'Agrega 3 empanadas a la orden 2' },
  { role: 'assistant', content: '{"intent":"add_item","entities":{"identifier":"ORDEN-002","name":"empanadas","quantity":3}}' },
  { role: 'user', content: 'Hola' },
  { role: 'assistant', content: '{"intent":"none","entities":{}}' },
  { role: 'user', content: 'Buenas tardes' },
  { role: 'assistant', content: '{"intent":"none","entities":{}}' },
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
        if (parsed.intent) return parsed
      } catch {}
    }
    start = text.indexOf('{', start + 1)
  }
  return null
}

async function detectIntent(userText, config) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...FEW_SHOTS,
    { role: 'user', content: userText },
  ]
  const raw = await callOllama(messages, config)
  const parsed = extractJson(raw)
  if (!parsed) {
    console.warn('[intentAgent] could not parse response:', raw)
    return { intent: 'none', entities: {} }
  }
  return { intent: parsed.intent, entities: parsed.entities || {} }
}

module.exports = { detectIntent }
