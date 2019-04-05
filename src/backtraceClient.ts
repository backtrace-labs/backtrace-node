import { BacktraceClientOptions } from './model/backtraceClientOptions';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceApi } from './backtraceApi';

/**
 * Backtrace client
 */
export class BacktraceClient {
  private _memorizedAttributes: object = {};
  private _backtraceApi: BacktraceApi;
  constructor(public options: BacktraceClientOptions) {
    if (!options.endpoint) {
      throw new Error("Backtrace: missing 'endpoint' option.");
    }
    this.options = { ...new BacktraceClientOptions(), ...options };
    this._backtraceApi = new BacktraceApi(this.getSubmitUrl(), options.timeout);
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
    fileAttachments: string[] = []
  ): BacktraceReport {
    const attributes = this.combineClientAttributes(reportAttributes);
    const report = new BacktraceReport(payload, attributes, fileAttachments);
    report.setSourceCodeOptions(
      this.options.tabWidth,
      this.options.contextLineCount
    );
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
    fileAttachments: string[] = []
  ): Promise<void> {
    const report = this.createReport(
      payload,
      reportAttributes,
      fileAttachments
    );
    await this._backtraceApi.send(report);
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
    fileAttachments: string[] = []
  ): void {
    const report = this.createReport(
      payload,
      reportAttributes,
      fileAttachments
    );
    this._backtraceApi.send(report);
  }

  public sendReport(report: BacktraceReport): void {
    this._backtraceApi.send(report);
  }

  private getSubmitUrl(): string {
    let url = this.options.endpoint;
    if (url.includes('submit.backtrace.io')) {
      return url;
    }
    if (!this.options.token) {
      throw new Error(
        'Token is required if Backtrace-node have to build url to Backtrace'
      );
    }
    const uriSeparator = url.endsWith('/') ? '' : '/';
    return `${this.options.endpoint}${uriSeparator}post?format=json&token=${
      this.options.token
    }`;
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
    if (!!this.options.disableGlobalHandler) {
      this.registerGlobalHandler(
        !!this.options.allowMultipleUncaughtExceptionListeners
      );
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
      console.error(
        'Backtrace: multiple "uncaughtException" listeners attached.'
      );
      return;
    }

    process.on('uncaughtException', (e: Error) => {
      this.reportSync(e);
      throw e;
    });

    if (!multipleExceptionListener) {
      (process as NodeJS.EventEmitter).on(
        'newListener',
        (eventName: string, listener) => {
          if (eventName === 'uncaughtException') {
            // handle worst scenario when someone want to add new uncaughtException listener
            var err = new Error(
              "Backtrace: multiple 'uncaughtException' listeners attached."
            );
            console.error(err.stack);
            process.exit(1);
          }
        }
      );
    }
  }
}
