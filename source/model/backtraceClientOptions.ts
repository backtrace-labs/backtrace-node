export class BacktraceClientOptions {
  public timeout: number = 1000;
  public tabWidth: number = 8;
  public endpoint!: string;
  public token!: string;
  public attributes: object = {};
  public contextLineCount: number = 200;
  public rootPackageJson!: NodeRequire;
  public disableGlobalHandler: boolean = false;
  public handlePromises: boolean = false;
  public allowMultipleUncaughtExceptionListeners: boolean = false;
}
