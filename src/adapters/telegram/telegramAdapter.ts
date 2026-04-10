import TelegramBot from 'node-telegram-bot-api';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { IntentService } from '../../application/intentService';
import type { ActionService } from '../../application/actionService';
import type { OrderService } from '../../application/orderService';
import type { ITranscriberPort } from '../../ports/ITranscriberPort';

export class TelegramAdapter {
  constructor(
    private readonly bot: TelegramBot,
    private readonly intent: IntentService,
    private readonly action: ActionService,
    private readonly orders: OrderService,
    private readonly transcriber: ITranscriberPort,
  ) {}

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', (err) => {
        fs.unlink(dest, () => { /* ignore */ });
        reject(err);
      });
    });
  }

  private async handleUserMessage(chatId: number, userText: string): Promise<string> {
    const { intent, entities } = await this.intent.detect(userText);
    console.log(`[intent] ${intent}`, entities);

    const parsed = await this.action.generate(intent, entities, userText, String(chatId));
    return this.orders.dispatch(parsed, String(chatId));
  }

  start(): void {
    this.bot.onText(/\/orders/, (msg) => {
      const chatId = msg.chat.id;
      const orderList = this.orders.listOrders(String(chatId));
      if (orderList.length === 0) {
        this.bot.sendMessage(chatId, 'No tienes pedidos aún.').catch((err: unknown) => {
          console.error('sendMessage error:', err instanceof Error ? err.message : err);
        });
        return;
      }
      const lines = orderList.map((o) => {
        const itemList = o.items.length > 0
          ? o.items.map((i) => `  • ${i.name} x${i.quantity}`).join('\n')
          : '  (sin ítems)';
        return `*${o.identifier}* [${o.status}]\n${itemList}`;
      }).join('\n\n');
      this.bot.sendMessage(chatId, lines, { parse_mode: 'Markdown' }).catch((err: unknown) => {
        console.error('sendMessage error:', err instanceof Error ? err.message : err);
      });
    });

    this.bot.on('message', async (msg) => {
      if (!msg.text) return;
      const chatId = msg.chat.id;
      console.log(`[text] from ${chatId}: ${msg.text}`);
      const thinking = await this.bot.sendMessage(chatId, 'Thinking...');
      try {
        const reply = await this.handleUserMessage(chatId, msg.text);
        await this.bot.editMessageText(reply, { chat_id: chatId, message_id: thinking.message_id });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Error:', errMsg);
        await this.bot.editMessageText('Could not get a response from the AI.', { chat_id: chatId, message_id: thinking.message_id });
      }
    });

    this.bot.on('voice', async (msg) => {
      const chatId = msg.chat.id;
      const fileId = msg.voice!.file_id;
      console.log(`[voice] from ${chatId}, file_id: ${fileId}`);
      const status = await this.bot.sendMessage(chatId, 'Transcribing voice...');
      const tmpFile = path.join(os.tmpdir(), `tg_voice_${fileId}.oga`);
      try {
        const url = await this.bot.getFileLink(fileId);
        await this.downloadFile(url, tmpFile);
        const transcript = await this.transcriber.transcribe(tmpFile);
        console.log(`[voice] transcript: ${transcript}`);
        await this.bot.editMessageText('Getting AI response...', { chat_id: chatId, message_id: status.message_id });
        const reply = await this.handleUserMessage(chatId, transcript);
        await this.bot.editMessageText(`*Transcript:* ${transcript}\n\n*Response:* ${reply}`, {
          chat_id: chatId, message_id: status.message_id, parse_mode: 'Markdown',
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Voice pipeline error:', errMsg);
        const userMsg = errMsg.toLowerCase().includes('transcri') || errMsg.toLowerCase().includes('model')
          ? 'Could not transcribe voice message.'
          : 'Could not get a response from the AI.';
        await this.bot.editMessageText(userMsg, { chat_id: chatId, message_id: status.message_id });
      } finally {
        fs.unlink(tmpFile, () => { /* ignore */ });
      }
    });

    this.bot.on('polling_error', (err) => {
      console.error('Polling error:', err.message);
    });
  }
}
