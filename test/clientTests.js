const bt = require('../lib/index');
const { assert, expect } = require('chai');

describe('Client behaviour tests', () => {
  it('report require client', () => {
    expect(() => {
      bt.createReport();
    }).to.Throw('Must call bt.initialize first');
  });

  it('test', () => {
    const initModel = {
      endpoint: 'endpoint',
      token: 'token',
      disableGlobalHandler: true,
    };
    bt.initialize(initModel);
    const report = bt.createReport();
    report.sendSync();
  });

  it('Disabled global handler with disabled multiple exception listeners', () => {
    const initModel = {
      endpoint: 'endpoint',
      token: 'token',
      disableGlobalHandler: true,
    };
    bt.initialize(initModel);
    const report = bt.createReport();

    const res = report.payload;
    assert.equal(res.endpoint, initModel.endpoint);
    assert.equal(res.token, initModel.token);
  });

  it('Report should contain client attributes', () => {
    const clientAttributes = {
      name: 'test',
      surname: 'test-surname',
      age: 123,
      isValid: true,
      _weight: 100,
    };
    const initModel = {
      endpoint: 'endpoint',
      token: 'token',
      disableGlobalHandler: true,
      attributes: clientAttributes,
    };
    bt.initialize(initModel);
    const report = bt.createReport();
    const attributes = report.payload.report.attributes;

    for (const key in clientAttributes) {
      const value = clientAttributes[key];
      assert.equal(attributes[key], value);
    }
  });
  it('Should throw exception for invalid url', () => {
    const report = bt.createReport();
    report.send(data => {
      assert.equal(data.message, 'Invalid URL');
    });
  });
});
