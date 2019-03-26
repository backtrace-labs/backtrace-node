import { BacktraceClientOptions } from './model/backtraceClientOptions';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceApi } from './backtraceApi';

/**
 * Backtrace client
 */
export class BacktraceClient {
  private _memorizedAttributes: object = {};
  private _backtraceApi: BacktraceApi;
  constructor(private options: BacktraceClientOptions) {
    options = options || new BacktraceClientOptions();
    if (!options.endpoint) {
      throw new Error("Backtrace: missing 'endpoint' option.");
    }
    this._backtraceApi = new BacktraceApi(options.endpoint);
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
   * Send report asynchronously to Backtrace
   * @param arg report payload
   * @param arg2 attributes
   * @param arg3 file attachments paths
   */
  public async reportAsync(
    arg: Error | string,
    arg2: object | undefined = {},
    arg3: string[] = []
  ): Promise<void> {
    const attributes = this.combineClientAttributes(arg2);
    const report = new BacktraceReport(arg, attributes, arg3);
    await this._backtraceApi.send(report);
  }

  /**
   * Send report synchronosuly to Backtrace
   * @param error report payload
   * @param reportAttributes attributes
   * @param attachments file attachments paths
   */
  public reportSync(
    error: Error | string,
    reportAttributes: object | undefined = {},
    attachments: string[] = []
  ): void {
    const attributes = this.combineClientAttributes(reportAttributes);
    const report = new BacktraceReport(error, attributes, attachments);
    this._backtraceApi.send(report);
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
      console.log(
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

  private onUncaughtException(err: Error) {}
}
