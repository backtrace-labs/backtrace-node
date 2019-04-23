export interface ISourceCode {
  path: string;
  startLine: number;
  startColumn: number;
  text: string;
  tabWidth: number;
}

export interface ISourceScan {
  endLine: number;
  startLine: number;
  filePath: string;
}
export interface ISourceLocation {
  line: number;
  column: number;
}
