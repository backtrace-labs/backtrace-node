import { assert, expect } from 'chai';
import * as bt from '../source/index';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';

describe('Backtrace client tests', () => {
  beforeEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('newListener');
  });
  describe('Initialization tests', () => {
    it('Missing required endpoint', () => {
      expect(() => {
        const client = new bt.BacktraceClient((undefined as unknown) as BacktraceClientOptions);
      }).to.Throw();
    });

    it('Missing required endpoint', () => {
      expect(() => {
        const client = new bt.BacktraceClient({ endpoint: 'blah' } as BacktraceClientOptions);
      }).to.Throw();
    });
  });

  it('Client options assignment', () => {
    const clientOptions = new BacktraceClientOptions();
    clientOptions.endpoint = 'submit.backtrace.io/universe/3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564/json';
    const client = new bt.BacktraceClient(clientOptions);

    assert.equal(
      client.options.allowMultipleUncaughtExceptionListeners,
      clientOptions.allowMultipleUncaughtExceptionListeners,
    );
    assert.equal(client.options.attributes, clientOptions.attributes);
    assert.equal(client.options.contextLineCount, clientOptions.contextLineCount);
  });

  it('Mixing passed options with default', () => {
    const clientOptions: BacktraceClientOptions = {
      endpoint: 'https://endpoint.io',
      token: 'token',
    } as BacktraceClientOptions;

    const defaultOptions = new BacktraceClientOptions();

    const client = new bt.BacktraceClient(clientOptions);
    // check if clientOptions variable properties are assigned correctly
    assert.equal(client.options.endpoint, clientOptions.endpoint);
    assert.equal(client.options.token, clientOptions.token);

    // check default options
    assert.equal(client.options.timeout, defaultOptions.timeout);
    assert.equal(client.options.handlePromises, defaultOptions.handlePromises);
  });

  describe('Client memorize attributes', () => {
    let client!: bt.BacktraceClient;
    before(() => {
      client = new bt.BacktraceClient({
        endpoint: 'submit.backtrace.io/universe/3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564/json',
      } as BacktraceClientOptions);
    });

    it('Clear attributes', () => {
      client.memorize('foo', 'bar');
      client.memorize('test', 23);

      client.clearMemorizedAttributes();
      const res = client.checkMemorizedAttributes();
      assert.isEmpty(res);
    });

    it('Clear empty attributes', function() {
      this.retries(2);
      client.clearMemorizedAttributes();
      const res = client.checkMemorizedAttributes();
      assert.isEmpty(res);
    });

    it('Add attributes', () => {
      const attrData = {
        name: 'test',
        age: 99,
        isAvailable: false,
      };

      client.memorize('name', attrData.name);
      client.memorize('age', attrData.age);
      client.memorize('isAvailable', attrData.isAvailable);

      const result = client.checkMemorizedAttributes();

      assert.equal((result as any)['name'], attrData.name);
      assert.equal((result as any)['age'], attrData.age);
      assert.equal((result as any)['isAvailable'], attrData.isAvailable);

      client.clearMemorizedAttributes();
    });

    it('Replace attributes', () => {
      const firstValue = 'foo';
      const secondValue = 'bar';
      const key = 'test';
      client.memorize(key, firstValue);
      client.memorize(key, secondValue);

      const res = client.checkMemorizedAttributes();
      assert.equal((res as any)[key], secondValue);
      client.clearMemorizedAttributes();
    });
  });

  describe('Client report', () => {
    let client!: bt.BacktraceClient;
    const clientAttributes = {
      name: 'name',
      age: 99,
      ready: true,
    };

    before(() => {
      const credentials = ({
        endpoint: 'submit.backtrace.io/universe/3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564/json',
        attributes: clientAttributes,
      } as unknown) as BacktraceClientOptions;
      client = new bt.BacktraceClient(credentials);
    });

    it('Create new report', () => {
      const report = client.createReport('');
      assert.isNotEmpty(report);
    });

    describe('Payload creation', () => {
      const stringPayload: string[] = ['', '!', ' ', 'foo'];
      const errPayload: Error[] = [new Error(), new Error('err')];

      stringPayload.forEach((payload) => {
        it(`Create report with string payload: ${payload}`, () => {
          const report = client.createReport(payload);
          assert.isEmpty(report.classifiers);
          report.toJson().then((data) => {
            assert.equal(data.attributes['error.message'], payload);
          });
        });
      });

      errPayload.forEach((payload) => {
        it(`Create report with error payload with message: ${payload.message}`, async () => {
          const report = client.createReport(payload);
          expect(report.classifiers).to.eql([payload.name]);
          const data = await report.toJson();
          assert.equal(data.attributes['error.message'], payload.message);
        });
      });
    });

    describe('Mixing report and client attributes', () => {
      it('String error attribute should contain client attribute', () => {
        const msg = '';
        const report = client.createReport(msg);
        report.toJson().then((data) => {
          assert.equal(data.attributes['name'], clientAttributes.name);
          assert.equal(data.attributes['age'], clientAttributes.age);
          assert.equal(data.attributes['ready'], clientAttributes.ready);
        });
      });

      it('Exception error attribute should contain client attribute', () => {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        try {
          const attr = opts.attributes;
        } catch (err) {
          const report = client.createReport(err);
          report.toJson().then((data) => {
            assert.equal(data.attributes['name'], clientAttributes.name);
            assert.equal(data.attributes['age'], clientAttributes.age);
            assert.equal(data.attributes['ready'], clientAttributes.ready);
          });
        }
      });
    });

    describe('Mixing mamorized, report and client attributes', () => {
      it('String error attribute should contain client attribute', () => {
        const msg = '';
        const key = 'memorizeKey';
        const value = 'memorizeValue';
        client.memorize(key, value);
        const report = client.createReport(msg);
        report.toJson().then((data) => {
          assert.equal(data.attributes['name'], clientAttributes.name);
          assert.equal(data.attributes['age'], clientAttributes.age);
          assert.equal(data.attributes['ready'], clientAttributes.ready);
          assert.equal(data.attributes[key], value);
        });

        client.clearMemorizedAttributes();
      });

      it('Exception error attribute should contain client attribute', () => {
        const opts = (undefined as unknown) as BacktraceClientOptions;
        const key = 'memorizeKey';
        const value = 'memorizeValue';
        client.memorize(key, value);
        try {
          const attr = opts.attributes;
        } catch (err) {
          const report = client.createReport(err);
          report.toJson().then((data) => {
            assert.equal(data.attributes['name'], clientAttributes.name);
            assert.equal(data.attributes['age'], clientAttributes.age);
            assert.equal(data.attributes['ready'], clientAttributes.ready);
            assert.equal(data.attributes[key], value);
          });
        }
      });
    });
  });
});
