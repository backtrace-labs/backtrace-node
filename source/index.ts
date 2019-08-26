import { BacktraceClient } from './backtraceClient';
import { BacktraceClientOptions, IBacktraceClientOptions } from './model/backtraceClientOptions';
import * as btReport from './model/backtraceReport';
import { BacktraceResult } from './model/backtraceResult';
export { IBacktraceData } from './model/backtraceData';

let backtraceClient: BacktraceClient;

export { BacktraceClient } from './backtraceClient';
export { BacktraceReport as BtReport } from './model/backtraceReport';
export { BacktraceClientOptions, IBacktraceClientOptions } from './model/backtraceClientOptions';
/**
 * Initalize Backtrace Client and Backtrace node integration
 * @param configuration Bcktrace configuration
 */
export function initialize(configuration: BacktraceClientOptions | IBacktraceClientOptions): BacktraceClient {
  backtraceClient = new BacktraceClient(configuration);
  return backtraceClient;
}

/**
 * Returns used BacktraceClient
 */
export function getBacktraceClient() {
  return backtraceClient;
}

export function use(client: BacktraceClient) {
  backtraceClient = client;
}
/**
 * Send report asynchronously to Backtrace
 * @param arg report payload
 * @param arg2 attributes
 * @param arg3 file attachments paths
 */
export async function report(
  arg: () => void | Error | string | object,
  arg2: object | undefined = {},
  // tslint:disable-next-line: ban-types
  arg3: string[] | ((data?: Error) => void) = [],
  arg4: string[] = [],
): Promise<BacktraceResult> {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  let data: Error | string = '';
  if (arg instanceof Error || typeof arg === 'string') {
    data = arg;
  }
  if (typeof arg === 'object' && arg2 === {}) {
    arg2 = arg;
  }
  const attachments = arg3 instanceof Function ? arg4 : arg3;
  const callback = arg instanceof Function ? arg : arg3;
  const result = await backtraceClient.reportAsync(data, arg2, attachments);
  if (callback && callback instanceof Function) {
    callback(result.Error);
  }
  return result;
}

/**
 * Send report synchronosuly to Backtrace
 * @param error report payload
 * @param reportAttributes attributes
 * @param attachments file attachments paths
 */
export function reportSync(
  data: Error | string,
  attributes: object | undefined = {},
  attachments: string[] = [],
): BacktraceResult {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  return backtraceClient.reportSync(data, attributes, attachments);
}

/**
 * Generaten BacktraceReport with default configuration
 */
export function createReport(): btReport.BacktraceReport {
  return BacktraceReport();
}

/**
 * Generaten BacktraceReport with default configuration
 */
export function BacktraceReport(): btReport.BacktraceReport {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  const backtraceReport = backtraceClient.createReport('');
  backtraceReport.send = (callback: (err?: Error) => void) => {
    backtraceClient.sendReport(backtraceReport, callback);
  };
  backtraceReport.sendSync = (callback: (err?: Error) => void) => {
    backtraceClient.sendReport(backtraceReport, callback);
  };

  return backtraceReport;
}

export function errorHandlerMiddleware(err: Error, req: any, resp: any, next: any) {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  backtraceClient.reportSync(err, { ...req, ...resp });
  next(err);
}
