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

import { execSync } from 'child_process';
import { createHash, pseudoRandomBytes } from 'crypto';
import * as reg from 'native-reg';
import { hostname } from 'os';

type SupportedPlatforms = 'darwin' | 'linux' | 'freebsd' | 'win32';
const supportedPlatforms = ['darwin', 'linux', 'freebsd', 'win32'];

export function getPlatform() {
  const platform: SupportedPlatforms = process.platform as SupportedPlatforms;
  if (supportedPlatforms.indexOf(platform) === -1) {
    return null;
  }
  return platform;
}

const platform: SupportedPlatforms | null = getPlatform();

const guid: { [index: string]: string } = {
  darwin: 'ioreg -rd1 -c IOPlatformExpertDevice',
  linux: '( cat /var/lib/dbus/machine-id /etc/machine-id 2> /dev/null || hostname ) | head -n 1 || :',
  freebsd: 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid',
};

function hash(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

function expose(result: string): string | null {
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
      return null;
  }
}

function windowsMachineId(): string | null {
  const regVal = reg.getValue(reg.HKEY.LOCAL_MACHINE, 'SOFTWARE\\Microsoft\\Cryptography', 'MachineGuid');
  if (regVal) {
    return expose(regVal.toString());
  } else {
    return null;
  }
}

function nonWindowsMachineId(): string | null {
  try {
    if (platform !== null && guid[platform]) {
      return expose(execSync(guid[platform]).toString());
    } else {
      return null;
    }
  } catch (_e) {
    return null;
  }
}

export function generateUuid(name: string = hostname()): string {
  const defaultSize = 16;
  if (!name) {
    name = '';
  }
  const bytes = name
    ? Buffer.concat([Buffer.from(name, 'utf8'), Buffer.alloc(defaultSize)], defaultSize)
    : pseudoRandomBytes(16);
  return (
    bytes.slice(0, 4).toString('hex') +
    '-' +
    bytes.slice(4, 6).toString('hex') +
    '-' +
    bytes.slice(6, 8).toString('hex') +
    '-' +
    bytes.slice(8, 10).toString('hex') +
    '-' +
    bytes.slice(10, 16).toString('hex')
  );
}

/**
 * This function gets the OS native UUID/GUID synchronously, hashed by default.
 * @param {boolean} [original=false] If true return original value of machine id, otherwise return hashed value (sha - 256)
 */
export function machineIdSync(original: boolean = false): string {
  let id: string | null = null;
  if (platform === 'win32') {
    id = windowsMachineId();
  } else if (platform !== null) {
    id = nonWindowsMachineId();
  }
  if (id === null) {
    id = generateUuid();
  }

  return original ? id : hash(id);
}
