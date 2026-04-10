import type { OrderItem } from './domain/order';

export * from './domain/order';

export interface OllamaConfig {
  readonly host: string;
  readonly port: number;
  readonly model: string;
}

export interface IntentResult {
  intent: string;
  entities: Record<string, unknown>;
}

export type OrderAction =
  | { action: 'create_order'; params: { items: OrderItem[] }; message: string }
  | { action: 'query'; params: { sql: string }; message: string }
  | { action: 'cancel_order'; params: { identifier: string }; message: string }
  | { action: 'complete_order'; params: { identifier: string }; message: string }
  | { action: 'add_item'; params: { identifier: string; name: string; quantity: number }; message: string }
  | { action: 'remove_item'; params: { identifier: string; name: string }; message: string }
  | { action: 'modify_item'; params: { identifier: string; name: string; quantity: number }; message: string }
  | { action: 'none'; params: Record<string, never>; message: string };
