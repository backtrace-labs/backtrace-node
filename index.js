var crypto = require('crypto');
var spawnSync = require('child_process').spawnSync;
var path = require('path');

exports.initialize = initialize;

function initialize(options) {
  options = options || {};
  var allowMultipleUncaughtExceptionListeners = !!options.allowMultipleUncaughtExceptionListeners;

  if (!allowMultipleUncaughtExceptionListeners &&
      process.listenerCount('uncaughtException') !== 0)
  {
    abortDueToMultipleListeners();
  }

  var debugBacktrace = !!options.debugBacktrace;
  var timeout = options.timeout || 1000;
  var tabWidth = options.tabWidth || 8;
  var endpoint = options.endpoint;
  var token = options.token;

  if (!endpoint) throw new Error("Backtrace: missing 'endpoint' option.");
  if (!token) throw new Error("Backtrace: missing 'token' option.");

  process.on('uncaughtException', onUncaughtException);
  if (!allowMultipleUncaughtExceptionListeners) {
    process.on('newListener', onNewProcessListener);
  }

  function onUncaughtException(err) {
    var mem = process.memoryUsage();
    var payload = {
      report: {
        uuid: makeUuid(),
        timestamp: (new Date()).getTime(),
        lang: "nodejs",
        langVersion: process.version,
        attributes: {
          "process.age": Math.floor(process.uptime() * 1000),
          "uname.machine": process.arch,
          "uname.sysname": process.platform,
          "error.name": err.name,
          "error.message": err.message,
          "mem.rss": mem.rss,
          "mem.heap.total": mem.heapTotal,
          "mem.heap.used": mem.heapUsed,
        },
        env: process.env,
      },
      stack: err.stack,
      tabWidth: tabWidth,
      endpoint: endpoint,
      token: token,
    };

    var syncReportJs = path.join(__dirname, "sync_report.js");
    var args = [syncReportJs];
    if (debugBacktrace) {
      args.push("--debug");
    }
    var stdioValue = debugBacktrace ? 'inherit' : 'ignore';
    var payloadString = JSON.stringify(payload);

    spawnSync(process.execPath, args, {
      input: payloadString,
      timeout: timeout,
      stdio: [null, 'inherit', 'inherit'],
      encoding: 'utf8'
    });

    throw err;
  }

  function onNewProcessListener(eventName, listener) {
    if (eventName === 'uncaughtException') {
      abortDueToMultipleListeners();
    }
  }
}

function makeUuid() {
  var bytes = crypto.pseudoRandomBytes(16);
  return bytes.slice(0, 4).toString('hex') +
    '-' +
    bytes.slice(4, 6).toString('hex') +
    '-' +
    bytes.slice(6, 8).toString('hex') +
    '-' +
    bytes.slice(8, 10).toString('hex') +
    '-' +
    bytes.slice(10, 16).toString('hex');
}

function abortDueToMultipleListeners() {
  var err = new Error("Backtrace: multiple 'uncaughtException' listeners attached.");
  console.error(err.stack);
  process.exit(1);
}
