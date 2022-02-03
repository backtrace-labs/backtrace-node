import { assert } from 'chai';
import nock from 'nock';
import { BacktraceClient } from '../source';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';
import { BacktraceReport } from '../source/model/backtraceReport';
import { BacktraceResultStatus } from '../source/model/backtraceResult';

describe('Client report limit tests', () => {
  let client!: BacktraceClient;
  beforeEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('newListener');

    const basePath = 'https://submit.backtrace.io';
    const query = '/server/twixj0z0ifdonjhn1osoldrzvlwfg78cvrj8wqyqlhlci0bf7wg5mpmu2lqhfnyl/json';
    nock(basePath)
      .post(query)
      .reply(200, {
        _rxid: '00000000-78ab-5702-0000-000000000000',
        fingerprint: 'twixj0z0ifdonjhn1osoldrzvlwfg78cvrj8wqyqlhlci0bf7wg5mpmu2lqhfnyl',
        response: 'ok',
        unique: false,
      });

    const opts = {
      endpoint: basePath + query,
      rateLimit: 1,
    } as BacktraceClientOptions;
    client = new BacktraceClient(opts);
  });

  it('test correct send', async () => {
    const result = await client.reportAsync('');
    assert.notEqual(result.Status, BacktraceResultStatus.LimitReached);
  });

  it('test limit reach', async () => {
    // reach limit after this report
    await client.reportAsync('');
    for (let index = 0; index < 10; index++) {
      const limitReachResult = await client.reportAsync('');
      assert.equal(limitReachResult.Status, BacktraceResultStatus.LimitReached);
    }
  });

  it('test limit reach event', async () => {
    // reach limit after this report
    await client.reportAsync('');
    client.on('rate-limit', (report: BacktraceReport) => {
      assert.isNotEmpty(report);
    });
    await client.reportAsync('');
  });
});
