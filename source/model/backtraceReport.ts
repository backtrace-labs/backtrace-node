import { randomBytes, pseudoRandomBytes } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import * as os from 'os';
import packageJson from './../../package.json';
import { BacktraceStackTrace } from './backtraceStackTrace.js';
import {
  readModule,
  readModuleDependencies,
} from '../helpers/moduleResolver.js';
import { readProcessStatus } from '../helpers/processHelper.js';
import { BacktraceData } from './backtraceData.js';

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
   * Current report attributes
   */
  public attributes!: object;

  /**
   * Backtrace complex objet
   */
  public annotations!: object;

  /**
   * Thread information about current application
   */
  public stackTrace!: BacktraceStackTrace.BacktraceStackTrace;

  /**
   * Calling module information
   */
  private _callingModule!: NodeRequire;

  private _callingModulePath!: string;

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
    private clientAttributes: object = {},
    private attachments: string[] = []
  ) {
    if (!clientAttributes) {
      clientAttributes = {};
    }
    if (!attachments) {
      attachments = [];
    }
    this.setError(err);
  }

  /**
   * Set error in BacktraceReport object
   * @param err Current error
   */
  public setError(err: Error | string): void {
    if (this.isExceptionTypeReport(err)) {
    }
    // get stack trace to retrieve calling module information
    this.stackTrace = new BacktraceStackTrace.BacktraceStackTrace(err);
    // retrieve calling module object
    [this._callingModule, this._callingModulePath] = readModule(
      this.stackTrace.getCallingModulePath()
    );

    //combine attributes
    this.attributes = {
      ...this.clientAttributes,
      ...this.readBuiltInAttributes(),
    };
    //combine annotations
    this.annotations = this.readAnnotation();
  }

  /**
   * Add new attributes to existing report attributes
   * @param attributes new report attributes object
   */
  public addObjectAttributes(attributes: object): void {
    this.attributes = {
      ...this.attributes,
      ...attributes,
    };
  }

  public addAttribute(key: string, value: any): void {
    (this.attributes as any)[key] = value;
  }

  public addAnnotation(key: string, value: any): void {
    (this.annotations as any)[key] = value;
  }

  public getAttachments(): string[] {
    return this.attachments;
  }

  public toJson(): BacktraceData {
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
    };
  }
  private readBuiltInAttributes(): object {
    return {
      ...readProcessStatus(),
      ...this.readAttributes(),
      ...this.readErrorAttributes(),
    };
  }

  private isExceptionTypeReport(err: Error | string): err is Error {
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
    if (!this.isExceptionTypeReport(this.err)) {
      return {};
    }
    this.classifiers = [this.err.name];
    return {
      'error.message': this.err.message,
    };
  }

  private readAttributes(): object {
    const mem = process.memoryUsage();
    const result = {
      'process.age': Math.floor(process.uptime()),
      'uname.uptime': os.uptime(),
      'uname.machine': process.arch,
      'uname.version': os.release(),
      'uname.sysname': process.platform,
      'vm.rss.size': mem.rss,
      'gc.heap.total': mem.heapTotal,
      'gc.heap.used': mem.heapUsed,
      application: this._callingModule.name,
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
      dependencies: readModuleDependencies(this._callingModulePath),
    } as any;

    if (this.isExceptionTypeReport(this.err)) {
      result['Exception'] = this.err;
    }
    return result;
  }
}
