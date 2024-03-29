import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { BacktraceApi } from './backtraceApi';
import { ClientRateLimit } from './clientRateLimit';
import { readSystemAttributes } from './helpers/moduleResolver';
import { BacktraceClientOptions, IBacktraceClientOptions } from './model/backtraceClientOptions';
import { IBacktraceData } from './model/backtraceData';
import { BacktraceMetrics } from './model/backtraceMetrics';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceResult } from './model/backtraceResult';

/**
 * Backtrace client
 */
export class BacktraceClient extends EventEmitter {
  public options: BacktraceClientOptions;
  private _scopedAttributes: object = {};
  private _memorizedAttributes: object = {};
  private _backtraceApi: BacktraceApi;
  private _clientRateLimit: ClientRateLimit;
  private _symbolication = false;
  private _symbolicationMap?: Array<{ file: string; uuid: string }>;
  private attributes: object = {};
  private readonly _backtraceMetrics: BacktraceMetrics | undefined;

  constructor(clientOptions: IBacktraceClientOptions | BacktraceClientOptions) {
    super();
    if (!clientOptions.endpoint) {
      throw new Error(`Backtrace: missing 'endpoint' option.`);
    }
    this.options = {
      ...new BacktraceClientOptions(),
      ...clientOptions,
    } as BacktraceClientOptions;
    this._backtraceApi = new BacktraceApi(this.getSubmitUrl(), this.options.timeout);
    this._clientRateLimit = new ClientRateLimit(this.options.rateLimit);
    this.registerHandlers();
    this.setupScopedAttributes();

    this.attributes = this.getClientAttributes();
    if (this.options.enableMetricsSupport) {
      this._backtraceMetrics = new BacktraceMetrics(
        clientOptions as BacktraceClientOptions,
        () => {
          return this.getClientAttributes();
        },
        process.env.NODE_ENV === 'test' ? undefined : console,
      );
    }
  }

  private getClientAttributes() {
    return {
      ...readSystemAttributes(),
      ...this._scopedAttributes,
      ...this.options.attributes,
    };
  }

  /**
   * Memorize selected values from application.
   * Memorized attributes will be available in your next Backtrace report.
   * Memorized attributes will be only available for one report.
   * @param key attribute key
   * @param value attribute value
   */
  public memorize(key: string, value: any): void {
    (this._memorizedAttributes as any)[key] = value;
  }

  /**
   * Set symbolication info
   */
  public setSymbolication() {
    this._symbolication = true;
  }

  /**
   * Add symbolication map to each report.
   * @param symbolicationMap
   */
  public setSymbolicationMap(symbolicationMap: Array<{ file: string; uuid: string }>) {
    if (!symbolicationMap) {
      throw new Error('Symbolication map is undefined');
    }

    if (!Array.isArray(symbolicationMap)) {
      throw new TypeError('Invalid type of symbolication map');
    }
    const invalidValues = symbolicationMap.some((n) => !n.file || !n.uuid);
    if (invalidValues) {
      throw new TypeError('Symbolication map contains invalid values - missing file or uuid value');
    }

    this._symbolicationMap = symbolicationMap;
  }

  /**
   * Clear all saved attributes
   */
  public clearMemorizedAttributes(): void {
    this._memorizedAttributes = {};
  }

  /**
   * Returns all memorized attributes without clearing them.
   */
  public checkMemorizedAttributes(): object {
    return this._memorizedAttributes;
  }

  public createReport(
    payload: Error | string,
    reportAttributes: object | undefined = {},
    fileAttachments: string[] = [],
  ): BacktraceReport {
    this.emit('new-report', payload, reportAttributes);
    const attributes = this.combineClientAttributes(reportAttributes);
    const report = new BacktraceReport(payload, attributes, fileAttachments);
    report.symbolication = this._symbolication;
    if (this._symbolicationMap) {
      report.symbolicationMap = this._symbolicationMap;
    }
    report.setSourceCodeOptions(this.options.tabWidth, this.options.contextLineCount);
    return report;
  }
  /**
   * Send report asynchronously to Backtrace
   * @param payload report payload
   * @param reportAttributes attributes
   * @param fileAttachments file attachments paths
   */
  public async reportAsync(
    payload: Error | string,
    reportAttributes: object | undefined = {},
    fileAttachments: string[] = [],
  ): Promise<BacktraceResult> {
    const report = this.createReport(payload, reportAttributes, fileAttachments);
    this.emit('before-send', report);
    const limitResult = this.testClientLimits(report);
    if (limitResult) {
      return limitResult;
    }
    const result = await this._backtraceApi.send(report);
    this.emit('after-send', report, result);
    return result;
  }

  /**
   * Send report synchronosuly to Backtrace
   * @param payload report payload - error or string
   * @param reportAttributes attributes
   * @param fileAttachments file attachments paths
   */
  public reportSync(
    payload: Error | string,
    reportAttributes: object | undefined = {},
    fileAttachments: string[] = [],
  ): BacktraceResult {
    const report = this.createReport(payload, reportAttributes, fileAttachments);
    return this.sendReport(report);
  }

  public sendReport(report: BacktraceReport, callback?: (err?: Error) => void): BacktraceResult {
    this.emit('before-send', report);
    const limitResult = this.testClientLimits(report);
    if (limitResult) {
      return limitResult;
    }
    this._backtraceApi
      .send(report)
      .then((result) => {
        if (callback) {
          callback(result.Error);
        }
        this.emit('after-send', report, result);
      })
      .catch((err) => {
        if (callback) {
          callback(err);
        }
      });

    return BacktraceResult.Processing(report);
  }

  public async sendAsync(report: BacktraceReport): Promise<BacktraceResult> {
    this.emit('before-send', report);
    const limitResult = this.testClientLimits(report);
    if (limitResult) {
      return limitResult;
    }
    return await this._backtraceApi.send(report);
  }

  private testClientLimits(report: BacktraceReport): BacktraceResult | undefined {
    if (this.samplingHit()) {
      this.emit('sampling-hit', report);
      return BacktraceResult.OnSamplingHit(report);
    }

    const limitReach = this._clientRateLimit.skipReport(report);
    if (limitReach) {
      this.emit('rate-limit', report);
      return BacktraceResult.OnLimitReached(report);
    }
    return undefined;
  }

  private samplingHit(): boolean {
    return !!this.options.sampling && Math.random() > this.options.sampling;
  }

  private getSubmitUrl(): string {
    const url = this.options.endpoint;
    if (url.includes('submit.backtrace.io')) {
      return url;
    }
    // allow user to define full URL to Backtrace without defining a token if the token is already available
    // in the backtrace endpoint.
    if (url.includes('token=')) {
      return url;
    }
    if (!this.options.token) {
      throw new Error(
        'Token option is required if endpoint is not provided in `https://submit.backtrace.io/<universe>/<token>/json` format.',
      );
    }
    const uriSeparator = url.endsWith('/') ? '' : '/';
    return `${this.options.endpoint}${uriSeparator}post?format=json&token=${this.options.token}`;
  }

  private combineClientAttributes(attributes: object = {}): object {
    if (!attributes) {
      attributes = {};
    }
    return {
      ...attributes,
      ...this.attributes,
      ...this.options.attributes,
      ...this.getMemorizedAttributes(),
      ...this._scopedAttributes,
    };
  }

  private getMemorizedAttributes() {
    const result = this._memorizedAttributes;
    this._memorizedAttributes = {};
    return result;
  }

  private registerHandlers(): void {
    this._backtraceApi.on('before-data-send', (report: BacktraceReport, json: IBacktraceData) => {
      this.emit('before-data-send', report, json);
    });

    if (!this.options.disableGlobalHandler) {
      this.registerGlobalHandler(!!this.options.allowMultipleUncaughtExceptionListeners);
    }
    if (this.options.handlePromises) {
      this.registerPromiseHandler();
    }
  }

  private registerPromiseHandler(): void {
    // workaround for existing issue in TypeScript
    (process as NodeJS.EventEmitter).on('unhandledRejection', (err: Error) => {
      this.emit('unhandledRejection', err);
      this.reportAsync(err, undefined);
    });
  }
  private setupScopedAttributes() {
    const applicationPackageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(applicationPackageJsonPath)) {
      return;
    }
    const json = JSON.parse(fs.readFileSync(applicationPackageJsonPath, 'utf8'));
    this._scopedAttributes = {
      // a value for application name and version are required. If none are found, use unknown string.
      'application.version': json.version || 'unknown',
      application: json.name || 'unknown',
      main: json.main,
      description: json.description,
      author: typeof json.author === 'object' && json.author.name ? json.author.name : json.author,
    };
  }

  private registerGlobalHandler(multipleExceptionListener: boolean): void {
    const listenerCount: number = process.listenerCount('uncaughtException');
    if (!multipleExceptionListener && listenerCount !== 0) {
      console.error('Backtrace: multiple "uncaughtException" listeners attached.');
      return;
    }

    process.on('uncaughtException', (e: Error) => {
      this.emit('uncaughtException', e);
      this.reportSync(e);
      throw e;
    });

    if (!multipleExceptionListener) {
      (process as NodeJS.EventEmitter).on('newListener', (eventName: string, listener) => {
        if (eventName === 'uncaughtException') {
          // handle worst scenario when someone want to add new uncaughtException listener
          // tslint:disable-next-line: quotemark
          const err = new Error("Backtrace: multiple 'uncaughtException' listeners attached.");
          console.error(err.stack);
          process.exit(1);
        }
      });
    }
  }
}
