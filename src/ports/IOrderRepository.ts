import type { OrderWithItems, OrderItem, OrderStatus } from '../types';

export interface IOrderRepository {
  create(chatId: string, items: OrderItem[]): { identifier: string };
  setStatus(identifier: string, chatId: string, status: OrderStatus): void;
  addItem(identifier: string, chatId: string, name: string, quantity: number): void;
  removeItem(identifier: string, chatId: string, name: string): void;
  modifyItem(identifier: string, chatId: string, name: string, quantity: number): void;
  findByChat(chatId: string): OrderWithItems[];
  executeQuery(sql: string, chatId: string): Record<string, unknown>[];
}
