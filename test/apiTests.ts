import nock from 'nock';
import * as bt from '../src/index';
import { BacktraceClient } from '../src';
import { BacktraceClientOptions } from '../src/model/backtraceClientOptions';

describe('Integration tests', () => {
  describe('Correct send', () => {
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
      } as BacktraceClientOptions;
      client = new BacktraceClient(opts);
      bt.initialize(opts);
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
        await bt.reportAsync(err);
      }
    });

    it('Report generated exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        const report = bt.createReport();
        report.setError(err);
        report.send();
      }
    });
  });

  describe('Invalid send result', () => {
    let client!: BacktraceClient;
    beforeEach(() => {
      const basePath = 'https://submit.backtrace.io';
      const query = '/server/token/json';
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
        await bt.reportAsync(err);
      }
    });

    it('Report generated exception from index', async () => {
      try {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const attr = opts.attributes;
      } catch (err) {
        const report = bt.createReport();
        report.setError(err);
        report.send();
      }
    });
  });
});
