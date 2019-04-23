import { assert } from 'chai';
import nock from 'nock';
import { BacktraceClient } from '..';
import * as bt from '../index';
import { BacktraceClientOptions } from '../model/backtraceClientOptions';
import { IBacktraceData } from '../model/backtraceData';
import { BacktraceReport } from '../model/backtraceReport';
import { BacktraceResultStatus } from '../model/backtraceResult';

describe('Emitter tests', () => {
  let client!: BacktraceClient;
  beforeEach(() => {
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
    bt.initialize(opts);
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
