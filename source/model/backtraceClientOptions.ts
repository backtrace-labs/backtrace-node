export class BacktraceClientOptions implements IBacktraceClientOptions {
  public timeout: number = 15000;
  public endpoint!: string;
  public token?: string;
  public attributes: object = {};

  public disableGlobalHandler: boolean = false;
  public handlePromises: boolean = false;
  public allowMultipleUncaughtExceptionListeners: boolean = false;

  public tabWidth: number = 8;
  public contextLineCount: number = 200;

  public sampling: number | undefined = undefined;
  public rateLimit: number = 0;
}

export interface IBacktraceClientOptions {
  timeout?: number;
  endpoint: string;
  token?: string;
  attributes?: object;
  disableGlobalHandler?: boolean;
  handlePromises?: boolean;
  allowMultipleUncaughtExceptionListeners?: boolean;
  tabWidth?: number;
  contextLineCount?: number;
  sampling?: number | undefined;
  rateLimit?: number;
}
