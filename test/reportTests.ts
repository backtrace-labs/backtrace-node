import { assert, expect } from 'chai';
import * as bt from '../source/index';
import { BacktraceClientOptions } from '../source/model/backtraceClientOptions';
import { BacktraceReport } from '../source/model/backtraceReport';

describe('Backrace report tests', () => {
  describe('Initialization tests', () => {
    it('Initialize report', () => {
      const report = new BacktraceReport();
      assert.isNotEmpty(report);
    });

    it('Initialize report with attributes', async () => {
      const attributes = { foo: 'foo', bar: 'bar' };
      const report = new BacktraceReport('', attributes);
      assert.isNotEmpty(report);

      const data = await report.toJson();
      assert.equal(data.attributes['foo'], attributes.foo);
      assert.equal(data.attributes['bar'], attributes.bar);
    });

    it('Initialize report with attachments', async () => {
      const attachments = ['path', 'to', 'attachments'];
      const report = new BacktraceReport('', {}, attachments);
      assert.isNotEmpty(report);

      expect(report.getAttachments()).to.eql(attachments);
    });

    it('Initialize report with attributes and attachments', async () => {
      const attributes = { foo: 'foo', bar: 'bar' };
      const attachments = ['path', 'to', 'attachments'];
      const report = new BacktraceReport('', attributes, attachments);
      assert.isNotEmpty(report);
      expect(report.getAttachments()).to.eql(attachments);

      const data = await report.toJson();
      assert.equal(data.attributes['foo'], attributes.foo);
      assert.equal(data.attributes['bar'], attributes.bar);
    });

    const msgs = ['', ' ', '`', '!@#$%'];
    msgs.forEach((msg) => {
      it(`Initialize message report - with string parameter: ${msg}`, async () => {
        const report = new BacktraceReport(msg);
        assert.isEmpty(report.classifiers);
        const json = await report.toJson();
        assert.equal(json.attributes['error.message'] as string, msg);
      });
    });

    const errors = [new Error(), new Error('')];
    errors.forEach((err) => {
      it(`Initialize exception report - with exception parameter: ${err}`, async () => {
        const report = new BacktraceReport(err);
        expect(report.classifiers).to.eql([err.name]);
        const json = await report.toJson();
        assert.equal(json.attributes['error.message'] as string, err.message);
      });
    });

    msgs.forEach((msg) => {
      errors.forEach((err) => {
        it(`Check initialization parameter change from string to error:: string == ${msg} err == ${err}`, async () => {
          const report = new BacktraceReport(msg);

          // check string information
          assert.isFalse(report.isExceptionTypeReport());
          const msgData = await report.toJson();
          assert.equal(msgData.attributes['error.message'] as string, msg);

          // setup error information
          report.setError(err);
          assert.isTrue(report.isExceptionTypeReport());
          const exData = await report.toJson();
          assert.equal(exData.attributes['error.message'] as string, err.message);
        });

        it(`Check initialization parameter change from error to string`, async () => {
          const report = new BacktraceReport(err);

          // setup error information
          assert.isTrue(report.isExceptionTypeReport());
          const exData = await report.toJson();
          assert.equal(exData.attributes['error.message'] as string, err.message);

          // setup msg
          report.setError(msg);
          assert.isFalse(report.isExceptionTypeReport());
          const msgData = await report.toJson();
          assert.equal(msgData.attributes['error.message'] as string, msg);
        });
      });
    });
  });

  describe('Report information', () => {
    it('Check each report attribute', () => {
      const timeBeforeReport = Math.floor(new Date().getTime() / 1000);
      const report = new BacktraceReport();
      const timeAfterReport = Math.floor(new Date().getTime() / 1000);
      assert.equal(report.lang, 'nodejs');
      assert.isTrue(timeAfterReport >= report.timestamp && report.timestamp >= timeBeforeReport);
      assert.isNotEmpty(report.uuid);
      assert.equal(report.mainThread, 'main');
    });

    const keys = ['foo', 'bar', ' ', '-', '  '];
    const values: any = [false, 1, 123, '123', '!@#$%'];

    keys.forEach((key) => {
      values.forEach((value: any) => {
        it('Add report attribute', async () => {
          const report = new BacktraceReport();
          report.addAttribute(key, value);
          const data = await report.toJson();
          assert.equal(data.attributes[key] as any, value);
        });
      });
    });

    const userData = {
      adult: true,
      age: 9999,
      name: 'username',
    };

    it('Add report annotation', async () => {
      const report = new BacktraceReport();
      report.addAnnotation('user', userData);
      const data = await report.toJson();
      expect(data.annotations['user']).to.eql(userData);
    });

    it('Add report attributes', async () => {
      const attributes: { [index: string]: any } = {
        name: userData.name,
        age: userData.age,
        adult: userData.adult,
      };
      const report = new BacktraceReport();
      report.addObjectAttributes(attributes);
      const data = await report.toJson();

      assert.equal(data.attributes['name'], attributes.name);
      assert.equal(data.attributes['age'], attributes.age);
      assert.equal(data.attributes['adult'], attributes.adult);
    });

    it('Add attachments', () => {
      const report = new BacktraceReport();
    });
  });

  describe('Report generation', () => {
    before(() => {
      bt.initialize({
        endpoint: 'endpoint',
        token: 'token',
      } as BacktraceClientOptions);
    });
    it('Generate report - createReport method', () => {
      const report = bt.createReport();
      assert.isNotEmpty(report);
    });

    it('Generate report - BacktraceReport method', () => {
      const report = bt.BacktraceReport();
      assert.isNotEmpty(report);
    });
  });
});
