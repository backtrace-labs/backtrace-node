import { BacktraceClientOptions } from './model/backtraceClientOptions';
import { BacktraceClient } from './backtraceClient';
import * as btReport from './model/backtraceReport';

let backtraceClient: BacktraceClient;

/**
 * Initalize Backtrace Client and Backtrace node integration
 * @param configuration Bcktrace configuration
 */
export function initialize(configuration: BacktraceClientOptions): BacktraceClient {
  backtraceClient = new BacktraceClient(configuration);
  return backtraceClient;
}

/**
 * Send report asynchronously to Backtrace
 * @param arg report payload
 * @param arg2 attributes
 * @param arg3 file attachments paths
 */
export function reportAsync(
  arg: Function | Error | string | object,
  arg2: object | undefined = {},
  arg3: string[] = []
) {
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
  backtraceClient.reportAsync(data, arg2, arg3).then(() => {
    if (arg instanceof Function) {
      arg();
    }
  });
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
  attachments: string[] = []
) {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  backtraceClient.reportSync(data, attributes, attachments);
}

export function createReport() {
  return new btReport.BacktraceReport();
}

export function BacktraceReport() {
  return new btReport.BacktraceReport();
}

export function errorHandlerMiddleware(
  err: Error,
  req: any,
  resp: any,
  next: any
) {
  backtraceClient.reportSync(err, req);
  next(err);
}
