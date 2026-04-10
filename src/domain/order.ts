export interface OrderItem {
  name: string;
  quantity: number;
}

export const OrderStatus = {
  Active: 'active',
  Cancelled: 'cancelled',
  Completed: 'completed',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export interface DbOrder {
  id: number;
  identifier: string;
  chat_id: string;
  status: OrderStatus;
  created_at: string;
}

export interface OrderWithItems extends DbOrder {
  items: OrderItem[];
}
