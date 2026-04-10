export interface IMessagingPort {
  sendMessage(chatId: string, text: string, options?: { parseMode?: 'Markdown' }): Promise<void>;
}
