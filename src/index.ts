import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

import { OllamaAdapter }          from './adapters/ollama/ollamaAdapter';
import { SqliteOrderRepository }   from './adapters/sqlite/sqliteOrderRepository';
import { WhisperAdapter }          from './adapters/whisper/whisperAdapter';
import { TelegramAdapter }         from './adapters/telegram/telegramAdapter';
import { IntentService }           from './application/intentService';
import { ActionService }           from './application/actionService';
import { OrderService }            from './application/orderService';
import type { OllamaConfig }       from './types';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is not set. Copy .env.example to .env and add your token.');
  process.exit(1);
}

const ollamaConfig: OllamaConfig = {
  host: process.env.OLLAMA_HOST ?? 'localhost',
  port: parseInt(process.env.OLLAMA_PORT ?? '11434'),
  model: process.env.OLLAMA_MODEL ?? 'llama2:7b',
};

const llm         = new OllamaAdapter(ollamaConfig);
const repo        = new SqliteOrderRepository();
const transcriber = new WhisperAdapter(process.env.WHISPER_MODEL ?? 'small');
const intent      = new IntentService(llm);
const action      = new ActionService(llm, repo);
const orders      = new OrderService(repo);
const telegramBot = new TelegramBot(token, { polling: true });
const bot         = new TelegramAdapter(telegramBot, intent, action, orders, transcriber);

bot.start();
console.log('Bot started. Polling for messages...');
