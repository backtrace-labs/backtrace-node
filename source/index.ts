import { BacktraceClientOptions } from './model/backtraceClientOptions';
import { BacktraceClient } from './backtraceClient';
import * as btReport from './model/backtraceReport';

let backtraceClient: BacktraceClient;
export function initialize(configuration: BacktraceClientOptions) {
  backtraceClient = new BacktraceClient(configuration);
}

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
