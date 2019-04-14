import nock from 'nock';
import * as bt from '../src/index';
import { assert } from 'chai';
import { BacktraceClient } from '../src';
import { BacktraceClientOptions } from '../src/model/backtraceClientOptions';
import { BacktraceResultStatus } from '../src/model/backtraceResult';
import { BacktraceReport } from '../src/model/backtraceReport';
import { BacktraceData } from '../src/model/backtraceData';

describe('Client report limit tests', () => {
  let client!: BacktraceClient;
  beforeEach(() => {
    const basePath = 'https://submit.backtrace.io';
    const query = '/server/token/json';
    nock(basePath)
      .post(query)
      .reply(200, {
        _rxid: '00000000-78ab-5702-0000-000000000000',
        fingerprint:
          '3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564',
        response: 'ok',
        unique: false,
      });

    const opts = {
      endpoint: basePath + query,
      rateLimit: 1,
    } as BacktraceClientOptions;
    client = new BacktraceClient(opts);
    bt.initialize(opts);
  });

  it('test correct send', async () => {
    const result = await client.reportAsync('');
    assert.notEqual(result.Status, BacktraceResultStatus.LimitReached);
  });

  it('test limit reach', async () => {
    //reach limit after this report
    await client.reportAsync('');
    for (let index = 0; index < 10; index++) {
      const limitReachResult = await client.reportAsync('');
      assert.equal(limitReachResult.Status, BacktraceResultStatus.LimitReached);
    }
  });

  it('test limit reach event', async () => {
    //reach limit after this report
    await client.reportAsync('');
    client.on('rate-limit', (report: BacktraceReport) => {
      assert.isNotEmpty(report);
    });
    await client.reportAsync('');
  });
});
