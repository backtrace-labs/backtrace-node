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

import { exec, execSync } from 'child_process';
import { createHash } from 'crypto';
import * as reg from 'native-reg';

type SupportedPlatforms = 'darwin' | 'linux' | 'freebsd' | 'win32';
const supportedPlatforms = ['darwin', 'linux', 'freebsd', 'win32'];

export function getPlatform() {
  const platform: SupportedPlatforms = process.platform as SupportedPlatforms;
  if (supportedPlatforms.indexOf(platform) === -1) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  return platform;
}

const platform: SupportedPlatforms = getPlatform();

const guid = {
  darwin: 'ioreg -rd1 -c IOPlatformExpertDevice',
  linux: '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :',
  freebsd: 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid',
};

function hash(guid: string): string {
  return createHash('sha256').update(guid).digest('hex');
}

function expose(result: string): string {
  switch (platform) {
    case 'darwin':
      return result
        .split('IOPlatformUUID')[1]
        .split('\n')[0]
        .replace(/\=|\s+|\"/gi, '')
        .toLowerCase();
    case 'win32':
      return result
        .toString()
        .split('REG_SZ')[1]
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    case 'linux':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    case 'freebsd':
      return result
        .toString()
        .replace(/\r+|\n+|\s+/gi, '')
        .toLowerCase();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function windowsMachineId(): string {
  const regVal = reg.getValue(reg.HKEY.LOCAL_MACHINE, 'SOFTWARE\\Microsoft\\Cryptography', 'MachineGuid') || 'null';
  return regVal.toString();
}

/**
 * This function gets the OS native UUID/GUID synchronously, hashed by default.
 * @param {boolean} [original=false] If true return original value of machine id, otherwise return hashed value (sha - 256)
 */
export function machineIdSync(original: boolean = false): string {
  const id = platform === 'win32' ? windowsMachineId() : expose(execSync(guid[platform]).toString());

  return original ? id : hash(id);
}

/**
 * This function gets the OS native UUID/GUID asynchronously (recommended), hashed by default.
 *
 * Note: on windows this is still synchronous
 * @param {boolean} [original=false] If true return original value of machine id, otherwise return hashed value (sha - 256)
 *
 */
export function machineId(original: boolean = false): Promise<string> {
  return new Promise(
    (resolve: Function, reject: Function): Object => {
      if (platform === 'win32') {
        try {
          return resolve(windowsMachineId());
        } catch (error) {
          return reject(error);
        }
      }

      return exec(guid[platform], {}, (err: any, stdout: any, _stderr: any) => {
        if (err) {
          return reject(new Error(`Error while obtaining machine id: ${err.stack}`));
        }

        const id = expose(stdout.toString());

        return resolve(original ? id : hash(id));
      });
    },
  );
}
