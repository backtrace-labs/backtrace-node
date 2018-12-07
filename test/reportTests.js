const bt = require('../lib/index');
const { assert, expect } = require('chai');
const package = require('../package.json');

describe('report Tests', () => {
  it('should contain basic report information', () => {
    const report = bt.createReport();
    const data = report.payload.report;
    assert.equal(data.agent, package.name);
    assert.equal(data.agentVersion, package.version);
    assert.equal(data.lang, 'nodejs');
  });

  it('should build valid empty report', () => {
    bt.initialize({
      endpoint: 'http://sp.backtrace.io:8080',
      token: 'token',
      disableGlobalHandler: true,
    });
    const report = bt.createReport();
    assert.isNotNull(report);
  });

  it('Report add attributes', () => {
    const attributes = ['test', true, 123];
    const report = bt.createReport();
    attributes.forEach((attr, index) => {
      report.addAttribute(`test-${index}`, attr);
    });
    attributes.forEach((attr, index) => {
      const val = report.payload.report.attributes[`test-${index}`];
      expect(val).to.not.be.undefined;
      assert.equal(val, attr);
    });
  });

  it('Report add annotation', () => {
    const annotations = [{ name: 'test' }, bt, 'string', 123123];
    const report = bt.createReport();
    annotations.forEach((annotation, index) => {
      report.addAnnotation(`test-${index}`, annotation);
    });
    annotations.forEach((annotation, index) => {
      const current = report.payload.report.annotations[`test-${index}`];
      assert.equal(JSON.stringify(current), JSON.stringify(annotation));
    });
  });

  it('Report with exception information', () => {
    const report = bt.createReport();
    const errMsg = 'unit test exception';
    const err = new Error(errMsg);
    err.additionaInformation = 'annorationTest';
    report.setError(err);

    const data = report.payload.report;
    const resMsg = data.attributes['error.message'];
    assert.equal(resMsg, errMsg);
    assert.equal(data.classifiers[0], err.name);

    const annotation = data.annotations['Error Properties'];
    assert.equal(annotation['additionaInformation'], err.additionaInformation);
  });

  it('Add report attributes to report object', () => {
    const report = bt.createReport();
    const objectAttribute = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
    };
    report.addObjectAttributes(objectAttribute);

    const attributes = report.payload.report.attributes;

    for (const key in objectAttribute) {
      const value = objectAttribute[key];
      assert.equal(attributes[key], value);
    }
  });

  it('Add report attributes with prefix to report object', () => {
    const report = bt.createReport();
    const objectAttribute = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
    };
    report.addObjectAttributes(objectAttribute, { prefix: 'bt-' });

    const attributes = report.payload.report.attributes;

    for (const key in objectAttribute) {
      const value = objectAttribute[key];
      assert.equal(attributes[`bt-${key}`], value);
    }
  });

  it('Add report attributes with prefix and private properties to report object', () => {
    const report = bt.createReport();
    const objectAttribute = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
      _weight: 100,
    };
    report.addObjectAttributes(objectAttribute, {
      prefix: 'bt-',
      allowPrivateProps: true,
    });

    const attributes = report.payload.report.attributes;

    for (const key in objectAttribute) {
      const value = objectAttribute[key];
      assert.equal(attributes[`bt-${key}`], value);
    }
  });

  it('Try to send report', () => {
    const report = bt.createReport();
    report.setError(new Error('err'));
    report.send(() => {
      assert.isTrue(true);
    });
  });

  it('Try to send report with attributes', () => {
    const report = bt.createReport();
    const objectAttribute = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
    };
    report.addObjectAttributes(objectAttribute, { prefix: 'bt-' });

    report.setError(new Error('err'));
    report.send(() => {
      assert.isTrue(true);
    });
  });

  it('Try to send report with attributes and annotations', () => {
    const annotations = [{ name: 'test' }, bt, 'string', 123123];
    const objectAttribute = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
    };
    const report = bt.createReport();
    annotations.forEach((annotation, index) => {
      report.addAnnotation(`test-${index}`, annotation);
    });
    report.addObjectAttributes(objectAttribute, { prefix: 'bt-' });

    report.setError(new Error('err'));
    report.send(() => {
      assert.isTrue(true);
    });
  });
});
