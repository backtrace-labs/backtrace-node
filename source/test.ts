import * as fs from 'fs';
import * as path from 'path';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceClient } from './backtraceClient';
import { BacktraceClientOptions } from './model/backtraceClientOptions';
import * as bt from '.';

function bar() {
  fs.readFileSync('not existing file');
}
function foo() {
  bar();
}
try {
  foo();
} catch (err) {
  const opts: BacktraceClientOptions = new BacktraceClientOptions();
  opts.endpoint = `https://submit.backtrace.io/yolo/328174ab5c377e2cdcb6c763ec2bbdf1f9aa5282c1f6bede693efe06a479db54/json?_mod_sync=1`;
  opts.allowMultipleUncaughtExceptionListeners = true;
  opts.handlePromises = true;
  opts.disableGlobalHandler = false;
  opts.contextLineCount = 200;
  const client = new BacktraceClient(opts);

  client.reportSync(
    err,
    {
      'sample attribute': 'attr',
      age: 25,
      name: 'Konrad',
      confirmed: true,
    },
    ['not existing file', '/mnt/c/Users/konra/source/BacktraceDatabase/a.json']
  );
}
