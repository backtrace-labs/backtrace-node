import { assert } from 'chai';
import nock from 'nock';
import { BacktraceClient } from '../source';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';
import { IBacktraceData } from '../source/model/backtraceData';
import { BacktraceReport } from '../source/model/backtraceReport';
import { BacktraceResultStatus } from '../source/model/backtraceResult';

describe('Emitter tests', () => {
  let client!: BacktraceClient;
  beforeEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('newListener');
    const basePath = 'https://submit.backtrace.io';
    const query = '/server/token/json';
    nock(basePath)
      .post(query)
      .reply(200, {
        _rxid: '00000000-78ab-5702-0000-000000000000',
        fingerprint: '3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564',
        response: 'ok',
        unique: false,
      });

    const opts = {
      endpoint: basePath + query,
    } as BacktraceClientOptions;
    client = new BacktraceClient(opts);
  });

  it('before-send event', () => {
    client.on('before-send', (report: BacktraceReport) => {
      assert.isNotEmpty(report);
    });
    client.reportSync('');
  });

  it('after-send event', () => {
    client.on('after-send', (report: BacktraceReport, result: BacktraceResultStatus) => {
      assert.isNotEmpty(report);
      assert.isNotEmpty(result);
    });
    client.reportSync('');
  });

  it('before-send event', () => {
    client.on('before-data-send', (report: BacktraceReport, data: IBacktraceData) => {
      assert.isNotEmpty(report);
      assert.isNotEmpty(data);
    });
    client.reportSync('');
  });
});
