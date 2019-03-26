import { BacktraceClientOptions } from './model/backtraceClientOptions';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceApi } from './backtraceApi';

/**
 * Backtrace client
 */
export class BacktraceClient {
  private _memorizedAttributes!: object;
  private _backtraceApi: BacktraceApi;
  constructor(private options: BacktraceClientOptions) {
    options = options || new BacktraceClientOptions();
    if (!options.endpoint) {
      throw new Error("Backtrace: missing 'endpoint' option.");
    }
    this._backtraceApi = new BacktraceApi(options.endpoint);
    this.registerHandlers();
  }

  public memorize(key: string, value: any): void {
    (this._memorizedAttributes as any)[key] = value;
  }

  public async reportAsync(
    arg: Error | string,
    arg2: object | undefined = {},
    arg3: string[] = []
  ): Promise<void> {
    const attributes = { ...arg2, ...this.options.attributes };
    const report = new BacktraceReport(arg, attributes, arg3);
    await this._backtraceApi.send(report);
  }

  public reportSync(
    error: Error | string,
    reportAttributes: object | undefined = {},
    attachments: string[] = []
  ): void {
    const attributes = { ...reportAttributes, ...this.options.attributes };
    const report = new BacktraceReport(error, attributes, attachments);
    this._backtraceApi.send(report);
  }

  private registerHandlers(): void {
    if (!this.options.disableGlobalHandler) {
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
