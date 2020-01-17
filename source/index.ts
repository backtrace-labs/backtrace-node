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
  arg: Error | string | object | ((data?: Error) => void),
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
 * Send report asynchronously to Backtrace
 * @param payload report payload
 * @param reportAttributes attributes
 * @param fileAttachments file attachments paths
 */
export async function reportAsync(
  payload: Error | string,
  reportAttributes: object | undefined = {},
  fileAttachments: string[] = [],
): Promise<BacktraceResult> {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  return await backtraceClient.reportAsync(payload, reportAttributes, fileAttachments);
}

/**
 * Send Backtrace report to Backtrace asynchronously.
 * @param data Backtrace report
 */
export async function sendAsync(data: btReport.BacktraceReport): Promise<BacktraceResult> {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  return await backtraceClient.sendAsync(data);
}

/**
 * Memorize selected values from application.
 * Memorized attributes will be available in your next Backtrace report.
 * Memorized attributes will be only available for one report.
 * @param key attribute key
 * @param value attribute value
 */
export function memorize(key: string, value: any): void {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }

  backtraceClient.memorize(key, value);
}

/**
 * Clear all saved attributes
 */
export function clearMemorizedAttributes(): void {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }
  backtraceClient.clearMemorizedAttributes();
}

/**
 * Returns all memorized attributes without clearing them.
 */
export function checkMemorizedAttributes(): object {
  return backtraceClient?.checkMemorizedAttributes();
}

/**
 * Set symbolication info
 */
export function setSymbolication() {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }

  backtraceClient.setSymbolication();
}

/**
 * Add symbolication map to each report.
 * @param symbolicationMap
 */
export function setSymbolicationMap(symbolicationMap: Array<{ file: string; uuid: string }>) {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }

  backtraceClient.setSymbolicationMap(symbolicationMap);
}

/**
 * Send backtrace report to Backtrace
 */
export function sendReport(data: btReport.BacktraceReport, callback?: (err?: Error) => void): BacktraceResult {
  if (!backtraceClient) {
    throw new Error('Must call initialize method first');
  }

  return backtraceClient.sendReport(data, callback);
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
