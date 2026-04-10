export interface ITranscriberPort {
  transcribe(filePath: string): Promise<string>;
}
