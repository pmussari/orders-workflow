import Database from 'better-sqlite3';
import path from 'path';

import { DbOrder, OrderItem, OrderWithItems } from './types';

const db = new Database(path.join(__dirname, '..', 'orders.db'));

export function initDb(): void {
  db.exec(`
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

function getNextIdentifier(): string {
  const row = db.prepare(`SELECT identifier FROM orders ORDER BY id DESC LIMIT 1`).get() as Pick<DbOrder, 'identifier'> | undefined;
  if (!row) return 'ORDEN-001';
  const num = parseInt(row.identifier.split('-')[1]) + 1;
  return `ORDEN-${String(num).padStart(3, '0')}`;
}

export function createOrder(chatId: number | string, items: OrderItem[] = []): { identifier: string } {
  const identifier = getNextIdentifier();
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO orders (identifier, chat_id) VALUES (?, ?)`
  ).run(identifier, String(chatId));

  const insertItem = db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`);
  for (const item of items) {
    insertItem.run(lastInsertRowid, item.name, item.quantity ?? 1);
  }
  return { identifier };
}

export function cancelOrder(identifier: string, chatId: number | string): void {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId)) as Pick<DbOrder, 'id'> | undefined;
  if (!order) throw new Error(`Order ${identifier} not found for this customer`);
  db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(order.id);
}

export function completeOrder(identifier: string, chatId: number | string): void {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId)) as Pick<DbOrder, 'id'> | undefined;
  if (!order) throw new Error(`Order ${identifier} not found for this customer`);
  db.prepare(`UPDATE orders SET status = 'completed' WHERE id = ?`).run(order.id);
}

export function addItem(identifier: string, name: string, quantity: number, chatId: number | string): void {
  let order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId)) as Pick<DbOrder, 'id'> | undefined;
  if (!order) {
    // Auto-create order if it doesn't exist for this customer
    const { identifier: newId } = createOrder(chatId, []);
    order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(newId, String(chatId)) as Pick<DbOrder, 'id'>;
    console.log(`[db] auto-created ${newId} for chat ${chatId}`);
  }
  db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`).run(order.id, name, quantity ?? 1);
}

export function removeItem(identifier: string, name: string, chatId: number | string): void {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId)) as Pick<DbOrder, 'id'> | undefined;
  if (!order) throw new Error(`Order ${identifier} not found for this customer`);
  db.prepare(`DELETE FROM order_items WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(order.id, name);
}

export function modifyItem(identifier: string, name: string, quantity: number, chatId: number | string): void {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId)) as Pick<DbOrder, 'id'> | undefined;
  if (!order) throw new Error(`Order ${identifier} not found for this customer`);
  db.prepare(`UPDATE order_items SET quantity = ? WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(quantity, order.id, name);
}

export function getOrdersByChat(chatId: number | string): OrderWithItems[] {
  const orders = db.prepare(`SELECT * FROM orders WHERE chat_id = ? ORDER BY id DESC`).all(String(chatId)) as DbOrder[];
  return orders.map((order) => {
    const items = db.prepare(`SELECT name, quantity FROM order_items WHERE order_id = ?`).all(order.id) as OrderItem[];
    return { ...order, items };
  });
}

export function executeQuery(sql: string, chatId: number | string): Record<string, unknown>[] {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Only SELECT queries are allowed');
  if (/;/.test(sql)) throw new Error('Multiple statements are not allowed');
  return db.prepare(sql).all(String(chatId)) as Record<string, unknown>[];
}
