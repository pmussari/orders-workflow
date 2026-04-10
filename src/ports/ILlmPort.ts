export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILlmPort {
  call(messages: LlmMessage[]): Promise<string>;
}
