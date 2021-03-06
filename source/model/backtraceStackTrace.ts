import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { scanFile } from 'source-scan';
import { ISourceCode, ISourceLocation, ISourceScan } from './sourceCode';

/**
 * Reprresent single stack frame in stack trace
 */
interface IBacktraceStackFrame {
  funcName: string;
  sourceCode: string | undefined;
  path: string;
  line: number;
  column: number;
}

/**
 * Analyse stack trace generated by exception
 * Create Stack Frames and find calling library/program informaiton
 */
export class BacktraceStackTrace {
  public readonly fault: boolean = true;
  public readonly name = 'main';
  public stack: IBacktraceStackFrame[] = [];

  public sourceCodeInformation: { [index: string]: ISourceCode } = {};

  public symbolicationMaps?: Array<{ file: string; uuid: string }>;
  private symbolicationPaths = new Set<string>();
  private callingModulePath = '';
  private readonly stackLineRe = /\s+at (.+) \((.+):(\d+):(\d+)\)/;
  private requestedSourceCode: { [path: string]: { id: string; data: ISourceLocation[] } } = {};

  private tabWidth: number = 8;
  private contextLineCount: number = 200;

  constructor(private readonly error: Error) {}

  public setSourceCodeOptions(tabWidth: number, contextLineCount: number) {
    this.tabWidth = tabWidth;
    this.contextLineCount = contextLineCount;
  }

  /**
   * Get calling module path
   */
  public getCallingModulePath(): string | undefined {
    if (!this.stack || this.stack.length === 0) {
      return undefined;
    }
    // handle a situation when every one stack frame is from node_modules
    if (!this.callingModulePath) {
      const sourceCode = this.stack.find((n) => !!n.sourceCode);
      if (!sourceCode) {
        return undefined;
      }
      for (const key in this.requestedSourceCode) {
        if (this.requestedSourceCode.hasOwnProperty(key)) {
          if (this.requestedSourceCode[key].id === sourceCode.sourceCode) {
            this.callingModulePath = key;
          }
        }
      }
    }
    return this.callingModulePath;
  }

  /**
   * Get Json data from Stack trace object
   */
  public toJson() {
    return {
      name: this.name,
      fault: this.fault,
      stack: this.stack,
    };
  }

  /**
   * Get source code information
   */
  public getSourceCode(): { [index: string]: ISourceCode } {
    return this.sourceCodeInformation;
  }

  /**
   * Start parsing stack frames
   */
  public async parseStackFrames(includeSymbolication: boolean): Promise<void> {
    const stackTrace = this.error.stack;
    if (!stackTrace) {
      return;
    }
    const appPath = process.cwd();
    // get exception lines and remove first line of descrtiption
    const lines = stackTrace.split('\n').slice(1);
    const backtracePath = path.join('node_modules', 'backtrace-node');
    lines.forEach((line) => {
      const match = line.match(this.stackLineRe);
      if (!match || match.length < 4) {
        return;
      }
      const fullSourceCodePath = match[2];
      const backtraceLibStackFrame = fullSourceCodePath.indexOf(backtracePath) !== -1;
      if (backtraceLibStackFrame) {
        return;
      }

      let sourcePath = fullSourceCodePath;
      if (sourcePath) {
        sourcePath = path.relative(appPath, sourcePath);
      }

      const stackFrame = {
        funcName: match[1],
        path: sourcePath,
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      } as IBacktraceStackFrame;

      // ignore not existing stack frames
      if (fs.existsSync(fullSourceCodePath)) {
        stackFrame.sourceCode = this.addSourceRequest(stackFrame, fullSourceCodePath);
        // extend root object with symbolication information
        if (includeSymbolication) {
          this.symbolicationPaths.add(fullSourceCodePath);
        }
        if (this.isCallingModule(fullSourceCodePath)) {
          this.callingModulePath = fullSourceCodePath;
        }
      }

      this.stack.push(stackFrame);
    });

    // read source code information after reading all existing stack frames from stack trace
    await this.readSourceCode();
    if (includeSymbolication) {
      this.generateSymbolicationMap();
    }
  }
  private generateSymbolicationMap(): void {
    if (this.symbolicationPaths.size === 0) {
      return;
    }
    this.symbolicationMaps = [];
    this.symbolicationPaths.forEach(async (symbolicationPath) => {
      const file = fs.readFileSync(symbolicationPath, 'utf8');
      const hash = createHash('md5').update(file).digest('hex');

      this.symbolicationMaps?.push({
        file: symbolicationPath,
        uuid: this.convertHexToUuid(hash),
      });
    });
  }

  private convertHexToUuid(hex: string): string {
    return (
      hex.slice(0, 8) +
      '-' +
      hex.slice(8, 12) +
      '-' +
      hex.slice(12, 16) +
      '-' +
      hex.slice(16, 20) +
      '-' +
      hex.slice(20, 32)
    );
  }

  private addSourceRequest(stackFrame: IBacktraceStackFrame, fullPath: string): string {
    // add source code to existing list. Otherwise create empty array
    if (!this.requestedSourceCode[fullPath]) {
      this.requestedSourceCode[fullPath] = {
        data: [],
        id: randomBytes(20).toString('hex'),
      };
    }
    this.requestedSourceCode[fullPath].data.push({
      line: stackFrame.line,
      column: stackFrame.column,
    });
    return this.requestedSourceCode[fullPath].id;
  }

  private async readSourceCode(): Promise<void> {
    for (const key in this.requestedSourceCode) {
      if (this.requestedSourceCode.hasOwnProperty(key)) {
        const element = this.requestedSourceCode[key];

        let minLine = element.data[0].line;
        let maxLine = minLine;
        for (let i = 1; i < element.data.length; i += 1) {
          const item = element.data[i];
          minLine = Math.min(minLine, item.line);
          maxLine = Math.max(maxLine, item.line);
        }

        const parameter = {
          startLine: Math.max(minLine - this.contextLineCount + 1, 0),
          endLine: maxLine + this.contextLineCount,
          filePath: key,
        };
        const res = await this.getSourceCodeInformation(parameter);
        this.sourceCodeInformation[element.id] = res;
      }
    }
  }

  private async getSourceCodeInformation(parameter: ISourceScan): Promise<ISourceCode> {
    return new Promise<ISourceCode>((res, rej) => {
      scanFile(parameter, (err: Error, buff: Buffer) => {
        if (err) {
          rej(err);
          return;
        }
        res({
          startLine: parameter.startLine + 1,
          startColumn: 1,
          text: buff.toString('utf8'),
          tabWidth: this.tabWidth,
        });
      });
    });
  }

  private isCallingModule(sourcePath: string): boolean {
    return !!sourcePath && !this.callingModulePath && !sourcePath.includes('node_modules');
  }
}
