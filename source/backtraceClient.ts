import { ClientRateLimit } from './clientRateLimit';

import { EventEmitter } from 'events';
import { BacktraceApi } from './backtraceApi';
import { BacktraceClientOptions, IBacktraceClientOptions } from './model/backtraceClientOptions';
import { IBacktraceData } from './model/backtraceData';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceResult } from './model/backtraceResult';
/**
 * Backtrace client
 */
export class BacktraceClient extends EventEmitter {
  public options: BacktraceClientOptions;
  private _memorizedAttributes: object = {};
  private _backtraceApi: BacktraceApi;
  private _clientRateLimit: ClientRateLimit;

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
    const attributes = this.combineClientAttributes(reportAttributes);
    const report = new BacktraceReport(payload, attributes, fileAttachments);
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

  public sendReport(report: BacktraceReport): BacktraceResult {
    this.emit('before-send', report);
    const limitResult = this.testClientLimits(report);
    if (limitResult) {
      return limitResult;
    }
    this._backtraceApi.send(report).then((result) => {
      this.emit('after-send', report, result);
    });

    return BacktraceResult.Processing(report);
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
    if (!this.options.token) {
      throw new Error('Token is required if Backtrace-node have to build url to Backtrace');
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
      ...this.options.attributes,
      ...this.getMemorizedAttributes(),
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
      this.reportAsync(err, undefined);
    });
  }

  private registerGlobalHandler(multipleExceptionListener: boolean): void {
    const listenerCount: number = process.listenerCount('uncaughtException');
    if (!multipleExceptionListener && listenerCount !== 0) {
      console.error('Backtrace: multiple "uncaughtException" listeners attached.');
      return;
    }

    process.on('uncaughtException', (e: Error) => {
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
