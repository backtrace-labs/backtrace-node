import * as fs from 'fs';
import { scanFile } from 'source-scan';
import { ISourceCode, ISourceLocation, ISourceScan } from './sourceCode';

/**
 * Analyse stack trace generated by exception
 * Create Stack Frames and find calling library/program informaiton
 */
export class BacktraceStackTrace {
  public readonly fault: boolean = true;
  public readonly name = 'main';
  public stack: BacktraceStackFrame[] = [];

  public sourceCodeInformation: { [index: string]: ISourceCode } = {};
  private callingModulePath = '';
  private readonly stackLineRe = /\s+at (.+) \((.+):(\d+):(\d+)\)/;
  private requestedSourceCode: { [index: string]: ISourceLocation[] } = {};

  private error: Error;
  constructor(err: Error | string) {
    // handle reports with message
    if (!(err instanceof Error)) {
      err = new Error();
    }
    this.error = err;
  }

  /**
   * Get calling module path
   */
  public getCallingModulePath(): string {
    //handle a situation when every one stack frame is from node_modules
    if (!this.callingModulePath) {
      this.callingModulePath = this.stack[0].sourceCode;
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

  public getSourceCode(): { [index: string]: ISourceCode } {
    return this.sourceCodeInformation;
  }

  public async parseStackFrames(): Promise<void> {
    const stackTrace = this.error.stack;
    if (!stackTrace) {
      return;
    }
    //get exception lines and remove first line of descrtiption
    const lines = stackTrace.split('\n').slice(1);
    lines.forEach(line => {
      const match = line.match(this.stackLineRe);
      if (!match) {
        return;
      }

      const stackFrame = {
        funcName: match[1],
        sourceCode: match[2],
        library: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      };

      this.addSourceRequest(stackFrame);
      if (this.isCallingModule(stackFrame)) {
        this.callingModulePath = stackFrame.sourceCode;
      }
      this.stack.push(stackFrame);
    });

    // read source code information after reading all existing stack frames from stack trace
    await this.readSourceCode();
  }

  private addSourceRequest(stackFrame: BacktraceStackFrame): void {
    //ignore not existing stack frames
    if (!fs.existsSync(stackFrame.sourceCode)) {
      return;
    }
    // add source code to existing list. Otherwise create empty array
    this.requestedSourceCode[stackFrame.sourceCode] =
      this.requestedSourceCode[stackFrame.sourceCode] || [];
    this.requestedSourceCode[stackFrame.sourceCode].push({
      line: stackFrame.line,
      column: stackFrame.column,
    });
  }

  private async readSourceCode(): Promise<void> {
    for (const key in this.requestedSourceCode) {
      if (this.requestedSourceCode.hasOwnProperty(key)) {
        const element = this.requestedSourceCode[key];

        var minLine = element[0].line;
        var maxLine = minLine;
        for (var i = 1; i < element.length; i += 1) {
          var item = element[i];
          minLine = Math.min(minLine, item.line);
          maxLine = Math.max(maxLine, item.line);
        }
        const parameter = {
          startLine: minLine + 1,
          endLine: maxLine + 1,
          filePath: key,
        };
        const res = await this.getSourceCodeInformation(parameter);
        this.sourceCodeInformation[key] = res;
      }
    }
  }

  private async getSourceCodeInformation(
    parameter: ISourceScan
  ): Promise<ISourceCode> {
    return new Promise<ISourceCode>((res, rej) => {
      scanFile(parameter, (err, buff) => {
        if (err) {
          rej(err);
          return;
        }
        res({
          path: parameter.filePath,
          startLine: parameter.startLine,
          startColumn: 1,
          text: buff.toString('utf8'),
          tabWidth: 8,
        });
      });
    });
  }

  private isCallingModule(stackFrame: BacktraceStackFrame): boolean {
    return (
      !this.callingModulePath &&
      fs.existsSync(stackFrame.sourceCode) &&
      !stackFrame.sourceCode.includes('node_modules')
    );
  }
}

/**
 * Reprresent single stack frame in stack trace
 */
interface BacktraceStackFrame {
  funcName: string;
  sourceCode: string;
  library: string;
  line: number;
  column: number;
}

