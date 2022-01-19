import { assert, expect } from 'chai';
import * as bt from '../source/index';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';
import { BacktraceReport } from '../source/model/backtraceReport';

describe('Backrace symbolication tests', () => {
  beforeEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('newListener');
  });
  describe('Backtrace client tests', () => {
    const clientOptions = new BacktraceClientOptions();
    before(() => {
      clientOptions.endpoint = 'submit.backtrace.io/universe/3b71b789c054876f1c57f3e6f77e8606b6bb4a03828be386a6713d957a7de564/json';
    });

    describe('Backtrace client symbolication property tests', () => {
      it('Symbolication boolean value should change report properties', () => {
        const client = new bt.BacktraceClient(clientOptions);
        client.setSymbolication();
        const report = client.createReport(new Error());
        report.toJson().then((data) => {
          assert.exists(data.symbolication);
          assert.equal(data.symbolication, 'sourcemap');
        });
      });

      it(`Client without symbolication shouldn't include sourcemap property`, () => {
        const client = new bt.BacktraceClient(clientOptions);
        const report = client.createReport(new Error());
        report.toJson().then((data) => {
          assert.isUndefined(data.symbolication);
          assert.isUndefined(data.symbolication_maps);
        });
      });
    });

    describe('Backtrace client symbolication map property tests', () => {
      it('Symbolication map value should extend report', () => {
        const client = new bt.BacktraceClient(clientOptions);
        const symbolicationMap = [
          { file: 'a', uuid: '1' },
          { file: 'b', uuid: '2' },
        ];

        client.setSymbolicationMap(symbolicationMap);

        const report = client.createReport(new Error());
        report.toJson().then((data) => {
          assert.exists(data.symbolication);
          assert.equal(data.symbolication, 'sourcemap');

          assert.exists(data.symbolication_maps);
          assert.equal(data.symbolication_maps?.length, symbolicationMap.length);
          // tslint:disable-next-line:prefer-for-of
          for (let index = 0; index < symbolicationMap.length; index++) {
            const source = symbolicationMap[index];

            const comparer = data.symbolication_maps ? data.symbolication_maps[index] : undefined;
            assert.equal(source.file, comparer?.file);
            assert.equal(source.uuid, comparer?.uuid);
          }
        });
      });

      it('Should throw an exception when symbolication map is undefined', () => {
        const client = new bt.BacktraceClient(clientOptions);

        expect(() => {
          client.setSymbolicationMap((undefined as unknown) as Array<{ file: string; uuid: string }>);
        }).to.throw();
      });

      it(`Should throw an exception when symbolication map isn't an array`, () => {
        const client = new bt.BacktraceClient(clientOptions);

        expect(() => {
          client.setSymbolicationMap(('foo' as unknown) as []);
        }).to.throw();
      });

      it('Should throw an exception when symbolication map contains invalid properties', () => {
        const client = new bt.BacktraceClient(clientOptions);

        expect(() => {
          const map = [{ file: 'foo' }] as Array<{ file: string; uuid: string }>;
          client.setSymbolicationMap(map);
        }).to.throw();
      });

      it(`When user not set symbolication map, Backtrace shouldn't extend event`, () => {
        const client = new bt.BacktraceClient(clientOptions);
        const report = client.createReport(new Error());
        report.toJson().then((data) => {
          assert.isUndefined(data.symbolication);
          assert.isUndefined(data.symbolication_maps);
        });
      });
    });
  });

  describe('Backtrace report tests', () => {
    describe('Backtrace report symbolication property tests', () => {
      it('Symbolication boolean value should change report properties', () => {
        const report = new BacktraceReport();
        report.symbolication = true;
        report.toJson().then((data) => {
          assert.exists(data.symbolication);
          assert.equal(data.symbolication, 'sourcemap');
        });
      });

      it(`Client without symbolication shouldn't include sourcemap property`, () => {
        const report = new BacktraceReport();
        report.toJson().then((data) => {
          assert.isUndefined(data.symbolication);
          assert.isUndefined(data.symbolication_maps);
        });
      });
    });

    describe('Backtrace report symbolication map property tests', () => {
      it('Symbolication map value should extend report', () => {
        const report = new BacktraceReport();
        report.symbolication = true;

        const symbolicationMap = [
          { file: 'a', uuid: '1' },
          { file: 'b', uuid: '2' },
        ];

        report.symbolicationMap = symbolicationMap;
        report.toJson().then((data) => {
          assert.exists(data.symbolication);
          assert.equal(data.symbolication, 'sourcemap');

          assert.exists(data.symbolication_maps);
          assert.equal(data.symbolication_maps?.length, symbolicationMap.length);
          // tslint:disable-next-line:prefer-for-of
          for (let index = 0; index < symbolicationMap.length; index++) {
            const source = symbolicationMap[index];

            const comparer = data.symbolication_maps ? data.symbolication_maps[index] : undefined;
            assert.equal(source.file, comparer?.file);
            assert.equal(source.uuid, comparer?.uuid);
          }
        });
      });

      it('Should throw an exception when symbolication map is undefined', () => {
        const report = new BacktraceReport();
        expect(() => {
          report.symbolicationMap = (undefined as unknown) as Array<{ file: string; uuid: string }>;
        }).to.throw();
      });

      it(`Should throw an exception when symbolication map isn't an array`, () => {
        const report = new BacktraceReport();

        expect(() => {
          report.symbolicationMap = ('foo' as unknown) as [];
        }).to.throw();
      });

      it('Should throw an exception when symbolication map contains invalid properties', () => {
        const report = new BacktraceReport();
        expect(() => {
          const map = [{ file: 'foo' }] as Array<{ file: string; uuid: string }>;
          report.symbolicationMap = map;
        }).to.throw();
      });

      it(`When user not set symbolication map, Backtrace shouldn't extend event`, () => {
        const report = new BacktraceReport();

        report.toJson().then((data) => {
          assert.isUndefined(data.symbolication);
          assert.isUndefined(data.symbolication_maps);
        });
      });
    });
  });
});
