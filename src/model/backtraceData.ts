import { ISourceCode } from './sourceCode';

export interface BacktraceData {
  uuid: string;
  timestamp: number;
  lang: string;
  langVersion: string;
  agent: string;
  agentVersion: string;
  mainThread: string;
  attributes: object;
  annotations: object;
  threads: object;
  classifiers: string[];
  sourceCode: { [index: string]: ISourceCode };
}
