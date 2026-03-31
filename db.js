const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'orders.db'))

function initDb() {
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
  `)
}

function getNextIdentifier() {
  const row = db.prepare(`SELECT identifier FROM orders ORDER BY id DESC LIMIT 1`).get()
  if (!row) return 'ORDEN-001'
  const num = parseInt(row.identifier.split('-')[1]) + 1
  return `ORDEN-${String(num).padStart(3, '0')}`
}

function createOrder(chatId, items = []) {
  const identifier = getNextIdentifier()
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO orders (identifier, chat_id) VALUES (?, ?)`
  ).run(identifier, String(chatId))

  const insertItem = db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`)
  for (const item of items) {
    insertItem.run(lastInsertRowid, item.name, item.quantity || 1)
  }
  return { identifier }
}

function cancelOrder(identifier, chatId) {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId))
  if (!order) throw new Error(`Order ${identifier} not found for this customer`)
  db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(order.id)
}

function completeOrder(identifier, chatId) {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId))
  if (!order) throw new Error(`Order ${identifier} not found for this customer`)
  db.prepare(`UPDATE orders SET status = 'completed' WHERE id = ?`).run(order.id)
}

function addItem(identifier, name, quantity, chatId) {
  let order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId))
  if (!order) {
    // Auto-create order if it doesn't exist for this customer
    const { identifier: newId } = createOrder(chatId, [])
    order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(newId, String(chatId))
    console.log(`[db] auto-created ${newId} for chat ${chatId}`)
  }
  db.prepare(`INSERT INTO order_items (order_id, name, quantity) VALUES (?, ?, ?)`).run(order.id, name, quantity || 1)
}

function removeItem(identifier, name, chatId) {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId))
  if (!order) throw new Error(`Order ${identifier} not found for this customer`)
  db.prepare(`DELETE FROM order_items WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(order.id, name)
}

function modifyItem(identifier, name, quantity, chatId) {
  const order = db.prepare(`SELECT id FROM orders WHERE identifier = ? AND chat_id = ?`).get(identifier, String(chatId))
  if (!order) throw new Error(`Order ${identifier} not found for this customer`)
  db.prepare(`UPDATE order_items SET quantity = ? WHERE order_id = ? AND LOWER(name) = LOWER(?)`).run(quantity, order.id, name)
}

function getOrdersByChat(chatId) {
  const orders = db.prepare(`SELECT * FROM orders WHERE chat_id = ? ORDER BY id DESC`).all(String(chatId))
  return orders.map(order => {
    const items = db.prepare(`SELECT name, quantity FROM order_items WHERE order_id = ?`).all(order.id)
    return { ...order, items }
  })
}

function executeQuery(sql, chatId) {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Only SELECT queries are allowed')
  if (/;/.test(sql)) throw new Error('Multiple statements are not allowed')
  return db.prepare(sql).all(String(chatId))
}

module.exports = { initDb, createOrder, cancelOrder, completeOrder, addItem, removeItem, modifyItem, getOrdersByChat, executeQuery }
