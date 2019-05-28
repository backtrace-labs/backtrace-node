// tslint:disable-next-line: no-var-requires
const packageJson = require('./../../package.json');
import { pseudoRandomBytes } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import * as os from 'os';
import { readModule, readModuleDependencies } from '../helpers/moduleResolver';
import { readMemoryInformation, readProcessStatus } from '../helpers/processHelper';
import { IBacktraceData } from './backtraceData';
import { BacktraceStackTrace } from './backtraceStackTrace';

/**
 * BacktraceReport describe current exception/message payload message to Backtrace
 */
export class BacktraceReport {
  // reprot id
  public readonly uuid: string = this.generateUuid();
  // timestamp
  public readonly timestamp: number = Math.floor(new Date().getTime() / 1000);
  // lang
  public readonly lang = 'nodejs';
  // environment version
  public readonly langVersion = process.version;
  // Backtrace-ndoe name
  public readonly agent = packageJson.name;
  // Backtrace-node  version
  public readonly agentVersion = packageJson.version;
  // main thread name
  public readonly mainThread = 'main';

  public classifiers: string[] = [];

  /**
   * Deprecated
   * Please use client.sendReport instead
   * BacktraceReport generated by library allows you to
   * automatically send reports to Backtrace via send method
   */
  public send!: () => void | undefined;

  /**
   * Thread information about current application
   */
  public stackTrace!: BacktraceStackTrace;

  /**
   * Current report attributes
   */
  private attributes: { [index: string]: any } = {};

  /**
   * Backtrace complex objet
   */
  private annotations: { [index: string]: any } = {};

  /**
   * Calling module information
   */
  private _callingModule!: NodeRequire;

  private _callingModulePath!: string;

  private tabWidth: number = 8;
  private contextLineCount: number = 200;

  /**
   * Create new BacktraceReport - report information that will collect information
   * for Backtrace.
   *
   * Possible existing scenarios:
   * arg1: error + arg2: attributes = all required
   * arg1: object, arg2: nothing
   *
   * @param err Error or message - content to report
   * @param attributes Report attributes dictionary
   * @param attachments Report attachments that Backtrace will send to API
   */
  constructor(
    private err: Error | string = '',
    private clientAttributes: { [index: string]: any } = {},
    private attachments: string[] = [],
  ) {
    if (!clientAttributes) {
      clientAttributes = {};
    }
    this.splitAttributesFromAnnotations(clientAttributes);
    if (!attachments) {
      attachments = [];
    }
    this.setError(err);
  }
  /**
   * Check if report contains exception information
   */
  public isExceptionTypeReport(): boolean {
    return this.detectReportType(this.err);
  }

  public getPayload(): Error | string {
    return this.err;
  }
  /**
   * Set error or message in BacktraceReport object
   * @param err Current error
   */
  public setError(err: Error | string): void {
    this.err = err;
    this.classifiers = this.detectReportType(err) ? [err.name] : [];
  }

  /**
   * Add new attributes to existing report attributes
   * @param attributes new report attributes object
   */
  public addObjectAttributes(attributes: { [index: string]: any }): void {
    this.clientAttributes = {
      ...this.clientAttributes,
      ...this.attributes,
      ...attributes,
    };
  }

  public addAttribute(key: string, value: any): void {
    this.clientAttributes[key] = value;
  }

  public addAnnotation(key: string, value: object): void {
    this.annotations[key] = value;
  }

  public getAttachments(): string[] {
    return this.attachments;
  }

  public async toJson(): Promise<IBacktraceData> {
    // why library should wait to retrieve source code data?
    // architecture decision require to pass additional parameters
    // not in constructor, but in additional method.
    await this.collectReportInformation();

    return {
      uuid: this.uuid,
      timestamp: this.timestamp,
      lang: this.lang,
      langVersion: this.langVersion,
      mainThread: this.mainThread,
      classifiers: this.classifiers,
      threads: { main: this.stackTrace.toJson() },
      agent: this.agent,
      agentVersion: this.agentVersion,
      annotations: this.annotations,
      attributes: this.attributes,
      sourceCode: this.stackTrace.getSourceCode(),
    };
  }

  public setSourceCodeOptions(tabWidth: number, contextLineCount: number) {
    this.tabWidth = tabWidth;
    this.contextLineCount = contextLineCount;
  }

  private async collectReportInformation(): Promise<void> {
    // get stack trace to retrieve calling module information
    this.stackTrace = new BacktraceStackTrace(this.err);
    this.stackTrace.setSourceCodeOptions(this.tabWidth, this.contextLineCount);
    await this.stackTrace.parseStackFrames();
    // retrieve calling module object
    [this._callingModule, this._callingModulePath] = readModule(this.stackTrace.getCallingModulePath());

    // combine attributes
    this.attributes = {
      ...this.readBuiltInAttributes(),
      ...this.clientAttributes,
    };
    // combine annotations
    this.annotations = this.readAnnotation();
  }

  private readBuiltInAttributes(): object {
    return {
      ...readMemoryInformation(),
      ...readProcessStatus(),
      ...this.readAttributes(),
      ...this.readErrorAttributes(),
    };
  }

  private detectReportType(err: Error | string): err is Error {
    return err instanceof Error;
  }

  private generateUuid(): string {
    const bytes = pseudoRandomBytes(16);
    return (
      bytes.slice(0, 4).toString('hex') +
      '-' +
      bytes.slice(4, 6).toString('hex') +
      '-' +
      bytes.slice(6, 8).toString('hex') +
      '-' +
      bytes.slice(8, 10).toString('hex') +
      '-' +
      bytes.slice(10, 16).toString('hex')
    );
  }

  private readErrorAttributes(): object {
    if (!this.detectReportType(this.err)) {
      return {
        'error.message': this.err,
      };
    }
    this.classifiers = [this.err.name];
    return {
      'error.message': this.err.message,
    };
  }

  private readAttributes(): object {
    const mem = process.memoryUsage();
    const { name, version, main, description, author } = (this._callingModule || {}) as any;
    const result = {
      'process.age': Math.floor(process.uptime()),
      'uname.uptime': os.uptime(),
      'uname.machine': process.arch,
      'uname.version': os.release(),
      'uname.sysname': process.platform,
      'vm.rss.size': mem.rss,
      'gc.heap.total': mem.heapTotal,
      'gc.heap.used': mem.heapUsed,
      'node.env': process.env.NODE_ENV,
      'debug.port': process.debugPort,
      application: name,
      version,
      main,
      description,
      author,
      guid: machineIdSync(true),
      hostname: os.hostname(),
    } as any;

    const cpus = os.cpus();

    if (cpus && cpus.length > 0) {
      result['cpu.count'] = cpus.length;
      result['cpu.brand'] = cpus[0].model;
    }
    return result;
  }

  private readAnnotation(): object {
    const result = {
      'Environment Variables': process.env,
      'Exec Arguments': process.execArgv,
      Dependencies: readModuleDependencies(this._callingModulePath),
    } as any;

    if (this.detectReportType(this.err)) {
      result['Exception'] = this.err;
    }
    return { ...result, ...this.annotations };
  }

  private splitAttributesFromAnnotations(clientAttributes: { [index: string]: any }) {
    for (const key in clientAttributes) {
      if (clientAttributes.hasOwnProperty(key)) {
        const element = this.clientAttributes[key];
        if (!element) {
          continue;
        }
        if (typeof element === 'object') {
          this.annotations[key] = element;
        } else {
          this.attributes[key] = element;
        }
      }
    }
  }
}
