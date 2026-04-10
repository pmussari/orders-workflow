import { nodewhisper } from 'nodejs-whisper';
import type { ITranscriberPort } from '../../ports/ITranscriberPort';

export class WhisperAdapter implements ITranscriberPort {
  constructor(private readonly model: string) {}

  async transcribe(filePath: string): Promise<string> {
    const transcript = await nodewhisper(filePath, {
      modelName: this.model,
      autoDownloadModelName: this.model,
      removeWavFileAfterTranscription: true,
      whisperOptions: {
        outputInText: true,
        language: 'es',
      },
    });
    return transcript.trim();
  }
}
