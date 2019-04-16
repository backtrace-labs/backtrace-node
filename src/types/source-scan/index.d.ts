declare module 'source-scan' {
  export interface IScanFileOptions {
    filePath: string;
    startLine: number;
    endLine: number;
  }
  export function scanFile(options: IScanFileOptions, callback: (err: Error, buff: Buffer) => void): void;
}
