import http from 'http';
import type { ILlmPort, LlmMessage } from '../../ports/ILlmPort';
import type { OllamaConfig } from '../../types';

interface OllamaResponse {
  message?: { content?: string };
}

export class OllamaAdapter implements ILlmPort {
  constructor(private readonly config: OllamaConfig) {}

  call(messages: LlmMessage[]): Promise<string> {
    const { host, port, model } = this.config;
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
}
