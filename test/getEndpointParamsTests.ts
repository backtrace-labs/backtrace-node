import { getEndpointParams } from '../source/utils';
import { assert } from 'chai';

describe('Test Submission URL information in metrics support', () => {
  it('Test submit.backtrace.io universe name', () => {
    const expectedUniverseName = 'yolo';
    const expectedToken =
      '55555111112345eb7ae344f6e002de2e20c81fbdedf6991c2f3bb45b32b55555';
    const testSubmissionUrl = `https://submit.backtrace.io/${expectedUniverseName}/${expectedToken}/json`;

    const params = getEndpointParams(testSubmissionUrl);
    if (!params) {
      throw new Error(
        `Invalid test case - the test submission URL ${testSubmissionUrl} is invalid for current test`,
      );
    }

    assert.equal(params.universe, expectedUniverseName);
    assert.equal(params.token, expectedToken);
  });

  it('Test invalid submit.backtrace.io universe name', () => {
    const expectedUniverseName = 'yolo';
    const expectedToken =
      '55555111112345eb7ae344f6e002de2e20c81fbdedf6991c2f3bb45b32b55555';
    const testSubmissionUrl = `https://submit.backtrace.io/${expectedUniverseName}/definitely-not-a-valid-url/${expectedToken}/json`;

    const params = getEndpointParams(testSubmissionUrl);

    assert.isUndefined(params);
  });

  it('Test invalid submit.backtrace.io without token', () => {
    const expectedUniverseName = 'yolo';
    const testSubmissionUrl = `https://submit.backtrace.io/${expectedUniverseName}`;

    const params = getEndpointParams(testSubmissionUrl);

    assert.isUndefined(params);

  });

  it('Test valid on-premise <universe>.backtrace.io url with configuration token', () => {
    const expectedUniverseName = 'yolo';
    const expectedToken = '55555111112345eb7ae344f6e002de2e20c81fbdedf6991c2f3bb45b32b55555'
    const testSubmissionUrl = `https://${expectedUniverseName}.backtrace.io/`;

    const params = getEndpointParams(testSubmissionUrl, expectedToken);
    if (!params) {
      throw new Error(
        `Invalid test case - the test submission URL and ${testSubmissionUrl} and token ${expectedToken} are invalid for current test`,
      );
    }

    assert.equal(params.universe, expectedUniverseName);
    assert.equal(params.token, expectedToken);
  });

  it('Test valid on-premise <universe>.sp.backtrace.io url with configuration token', () => {
    const expectedUniverseName = 'yolo-with-sp';
    const expectedToken = '55555111112345eb7ae344f6e002de2e20c81fbdedf6991c2f3bb45b32b55555'
    const testSubmissionUrl = `https://${expectedUniverseName}.sp.backtrace.io/`;

    const params = getEndpointParams(testSubmissionUrl, expectedToken);
    if (!params) {
      throw new Error(
        `Invalid test case - the test submission URL and ${testSubmissionUrl} and token ${expectedToken} are invalid for current test`,
      );
    }

    assert.equal(params.universe, expectedUniverseName);
    assert.equal(params.token, expectedToken);
  });

  it('Test valid on-premise <universe>.sp.backtrace.io url with undefined configuration token', () => {
    const expectedUniverseName = 'yolo-with-sp';
    const expectedToken = undefined;
    const testSubmissionUrl = `https://${expectedUniverseName}.sp.backtrace.io/`;

    const params = getEndpointParams(testSubmissionUrl, expectedToken);
    if (!params) {
      throw new Error(
        `Invalid test case - the test submission URL and ${testSubmissionUrl} and token ${expectedToken} are invalid for current test`,
      );
    }

    assert.equal(params.universe, expectedUniverseName);
    assert.equal(params.token, expectedToken);
  });
});
