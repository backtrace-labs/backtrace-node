/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Aleksandr Komlev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* Based on source: https://github.com/Nokel81/node-machine-id/commit/ee2d03efca9e9ccb363e850093a2e6654137275c */

import { assert } from 'chai';
import { machineIdSync, getPlatform } from '../source/helpers/machineId';

let platform = getPlatform(),
  originalPattern = {
    darwin: /^[0-9,A-z]{8}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{12}$/,
    win32: /^[0-9,A-z]{8}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{12}$/,
    linux: /^[0-9,A-z]{32}$/,
    freebsd: /^[0-9,A-z]{8}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{4}-[0-9,A-z]{12}$/,
  },
  hashPattern = /^[0-9,A-z]{64}$/;

// these tests need to be run on each of the platforms above to test this in a comprehensive way
describe('Machine ID tests', () => {
  describe('Sync call (original=true): machineIdSync(true)', function () {
    it('should return original unique id', () => {
      if (platform === null) {
        throw 'null platform exception';
      }
      assert.match(machineIdSync(true), originalPattern[platform]);
    });
  });

  describe('Sync call: machineIdSync()', function () {
    it('should return unique sha256-hash', () => {
      assert.match(machineIdSync(), hashPattern);
    });
  });
});
