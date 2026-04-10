import type { ILlmPort, LlmMessage } from '../ports/ILlmPort';
import type { IntentResult } from '../types';

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
- none:           {}`;

const FEW_SHOTS: LlmMessage[] = [
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
];

function extractJson(text: string): IntentResult | null {
  let start = text.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        if (typeof parsed.intent === 'string') {
          return {
            intent: parsed.intent,
            entities: (parsed.entities as Record<string, unknown>) ?? {},
          };
        }
      } catch { /* try next */ }
    }
    start = text.indexOf('{', start + 1);
  }
  return null;
}

export class IntentService {
  constructor(private readonly llm: ILlmPort) {}

  async detect(userText: string): Promise<IntentResult> {
    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...FEW_SHOTS,
      { role: 'user', content: userText },
    ];
    const raw = await this.llm.call(messages);
    const parsed = extractJson(raw);
    if (!parsed) {
      console.warn('[intentService] could not parse response:', raw);
      return { intent: 'none', entities: {} };
    }
    return parsed;
  }
}
