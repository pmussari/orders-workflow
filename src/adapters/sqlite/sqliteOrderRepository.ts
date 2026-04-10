import Database from 'better-sqlite3';
import path from 'path';
import type { IOrderRepository } from '../../ports/IOrderRepository';
import type { DbOrder, OrderItem, OrderStatus, OrderWithItems } from '../../types';

export class SqliteOrderRepository implements IOrderRepository {
  private readonly db: Database.Database;

  constructor() {
    this.db = new Database(path.join(__dirname, '..', '..', '..', 'orders.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT UNIQUE NOT NULL,
        chat_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  private getNextIdentifier(): string {
    const row = this.db.prepare(`SELECT identifier FROM orders ORDER BY id DESC LIMIT 1`).get() as Pick<DbOrder, 'identifier'> | undefined;
    if (!row) return 'ORDEN-001';
    const num = parseInt(row.identifier.split('-')[1]) + 1;
    return `ORDEN-${String(num).padStart(3, '0')}`;
  }

  create(chatId: string, items: OrderItem[] = []): { identifier: string } {
    const identifier = this.getNextIdentifier();
    const { lastInsertRowid } = this.db.prepare(
      `INSERT INTO orders (identifier, chat_id) VALUES (?, ?)`
    ).run(identifier, chatId);

    const insertItem = this.db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`);
    for (const item of items) {
      insertItem.run(lastInsertRowid, item.name, item.quantity ?? 1);
    }
    return { identifier };
  }

  setStatus(identifier: string, chatId: string, status: OrderStatus): void {
    const order = this.db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, chatId) as Pick<DbOrder, 'id'> | undefined;
    if (!order) throw new Error(`Order ${identifier} not found for this customer`);
    this.db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, order.id);
  }

  addItem(identifier: string, chatId: string, name: string, quantity: number): void {
    let order = this.db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, chatId) as Pick<DbOrder, 'id'> | undefined;
    if (!order) {
      const { identifier: newId } = this.create(chatId, []);
      order = this.db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(newId, chatId) as Pick<DbOrder, 'id'>;
      console.log(`[db] auto-created ${newId} for chat ${chatId}`);
    }
    this.db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`).run(order.id, name, quantity ?? 1);
  }

  removeItem(identifier: string, chatId: string, name: string): void {
    const order = this.db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, chatId) as Pick<DbOrder, 'id'> | undefined;
    if (!order) throw new Error(`Order ${identifier} not found for this customer`);
    this.db.prepare(`DELETE FROM order_items WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(order.id, name);
  }

  modifyItem(identifier: string, chatId: string, name: string, quantity: number): void {
    const order = this.db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, chatId) as Pick<DbOrder, 'id'> | undefined;
    if (!order) throw new Error(`Order ${identifier} not found for this customer`);
    this.db.prepare(`UPDATE order_items SET quantity = ? WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(quantity, order.id, name);
  }

  findByChat(chatId: string): OrderWithItems[] {
    const orders = this.db.prepare(`SELECT * FROM orders WHERE chat_id = ? ORDER BY id DESC`).all(chatId) as DbOrder[];
    return orders.map((order) => {
      const items = this.db.prepare(`SELECT name, quantity FROM order_items WHERE order_id = ?`).all(order.id) as OrderItem[];
      return { ...order, items };
    });
  }

  executeQuery(sql: string, chatId: string): Record<string, unknown>[] {
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Only SELECT queries are allowed');
    if (/;/.test(sql)) throw new Error('Multiple statements are not allowed');
    return this.db.prepare(sql).all(chatId) as Record<string, unknown>[];
  }
}
