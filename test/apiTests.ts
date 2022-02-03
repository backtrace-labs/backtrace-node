import { assert } from 'chai';
import nock from 'nock';
import { BacktraceClient } from '../source';
import * as bt from '../source/index';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';
import { BacktraceResultStatus } from '../source/model/backtraceResult';

describe('Integration tests', () => {
  beforeEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('newListener');
  });
  describe('Correct send', () => {
    let client!: BacktraceClient;
    beforeEach(() => {
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
      } as BacktraceClientOptions;
      client = new BacktraceClient(opts);
      bt.use(client);
    });

    it('report exception', () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        client.reportSync(err);
      }
    });

    it('ASYNC: report exception', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        const result = await client.reportAsync(err);
        assert.equal(result.Status, BacktraceResultStatus.Ok);
      }
    });

    it('Report exception from index', () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        bt.reportSync(err);
      }
    });

    it('ASYNC: Report exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        await bt.report(err);
      }
    });

    it('Report generated exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        const report = bt.createReport();
        report.setError(err);
        if (report.send) {
          report.send((innerError) => {
            // console.log(innerError);
          });
        }
      }
    });
  });

  describe('Invalid send result', () => {
    let client!: BacktraceClient;
    beforeEach(() => {
      const basePath = 'https://submit.backtrace.io';
      const query = '/server/twixj0z0ifdonjhn1osoldrzvlwfg78cvrj8wqyqlhlci0bf7wg5mpmu2lqhfnyl/json';
      nock(basePath)
        .post(query)
        .reply(500, {});

      client = new BacktraceClient({
        endpoint: basePath + query,
      } as BacktraceClientOptions);
    });

    it('report exception', () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        client.reportSync(err);
      }
    });

    it('ASYNC: report exception', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        await client.reportAsync(err);
      }
    });

    it('Report exception from index', () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        bt.reportSync(err);
      }
    });

    it('ASYNC: Report exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        await bt.report(err);
      }
    });

    it('Report generated exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        const report = bt.createReport();
        if (report.send) {
          report.send((innerError) => {
            assert.isDefined(innerError);
          });
        }
      }
    });
  });
});
