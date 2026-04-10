import type { IOrderRepository } from '../ports/IOrderRepository';
import type { OrderAction, OrderWithItems } from '../types';

export class OrderService {
  constructor(private readonly repo: IOrderRepository) {}

  listOrders(chatId: string): OrderWithItems[] {
    return this.repo.findByChat(chatId);
  }

  private formatQueryRows(rows: Record<string, unknown>[], headerMessage: string): string {
    if (rows.length === 0) return 'No se encontraron resultados.';

    const byOrder: Record<string, { status: unknown; items: { name: unknown; quantity: unknown }[] }> = {};
    for (const row of rows) {
      if (typeof row.identifier === 'string') {
        if (!byOrder[row.identifier]) byOrder[row.identifier] = { status: row.status, items: [] };
        if (row.name) byOrder[row.identifier].items.push({ name: row.name, quantity: row.quantity });
      }
    }

    if (Object.keys(byOrder).length > 0) {
      const lines = Object.entries(byOrder).map(([id, o]) => {
        const itemList = o.items.length > 0
          ? o.items.map((i) => `  • ${i.name} x${i.quantity}`).join('\n')
          : '  (sin ítems)';
        return `*${id}* [${o.status}]\n${itemList}`;
      });
      return `${headerMessage}\n\n${lines.join('\n\n')}`;
    }

    const lines = rows.map((row) =>
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')
    );
    return `${headerMessage}\n\n${lines.join('\n')}`;
  }

  async dispatch(action: OrderAction, chatId: string): Promise<string> {
    const { message } = action;
    try {
      switch (action.action) {
        case 'create_order': {
          const { identifier } = this.repo.create(chatId, action.params.items);
          console.log(`[db] created ${identifier}`);
          break;
        }
        case 'query': {
          const rows = this.repo.executeQuery(action.params.sql, chatId);
          console.log(`[db] query for ${chatId}: ${action.params.sql}`);
          return this.formatQueryRows(rows, message);
        }
        case 'cancel_order':
          this.repo.setStatus(action.params.identifier, chatId, 'cancelled');
          console.log(`[db] cancelled ${action.params.identifier}`);
          break;
        case 'complete_order':
          this.repo.setStatus(action.params.identifier, chatId, 'completed');
          console.log(`[db] completed ${action.params.identifier}`);
          break;
        case 'add_item':
          this.repo.addItem(action.params.identifier, chatId, action.params.name, action.params.quantity);
          console.log(`[db] added item to ${action.params.identifier}`);
          break;
        case 'remove_item':
          this.repo.removeItem(action.params.identifier, chatId, action.params.name);
          console.log(`[db] removed item from ${action.params.identifier}`);
          break;
        case 'modify_item':
          this.repo.modifyItem(action.params.identifier, chatId, action.params.name, action.params.quantity);
          console.log(`[db] modified item in ${action.params.identifier}`);
          break;
        case 'none':
          break;
        default: {
          const _exhaustive: never = action;
          console.warn('[orderService] unhandled action:', _exhaustive);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[db error] ${msg}`);
      return 'No pude completar esa acción, por favor intenta de nuevo.';
    }
    return message || 'Listo, acción completada.';
  }
}
