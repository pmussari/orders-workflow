import http from 'http';

import { OllamaConfig } from '../types';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  message?: { content?: string };
}

export function callOllama(messages: OllamaMessage[], { host, port, model }: OllamaConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, stream: false, messages });
    const req = http.request(
      {
        host,
        port,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as OllamaResponse;
            resolve(parsed.message?.content ?? '(no response)');
          } catch {
            reject(new Error('Failed to parse Ollama response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
