var crypto = require('crypto');
var child_process = require('child_process');
var spawnSync = child_process.spawnSync;
var spawn = child_process.spawn;
var path = require('path');
var os = require('os');

exports.initialize = initialize;
exports.report = reportAsync;

var debugBacktrace;
var timeout;
var tabWidth;
var endpoint;
var token;

function initialize(options) {
  options = options || {};

  debugBacktrace = !!options.debugBacktrace;
  timeout = options.timeout || 1000;
  tabWidth = options.tabWidth || 8;
  endpoint = options.endpoint;
  token = options.token;

  var disableGlobalHandler = !!options.disableGlobalHandler;

  if (!endpoint) throw new Error("Backtrace: missing 'endpoint' option.");
  if (!token) throw new Error("Backtrace: missing 'token' option.");

  if (!disableGlobalHandler) {
    registerGlobalHandler(!!options.allowMultipleUncaughtExceptionListeners);
  }
}

function registerGlobalHandler(allowMultipleUncaughtExceptionListeners) {
  if (!allowMultipleUncaughtExceptionListeners &&
      process.listenerCount('uncaughtException') !== 0)
  {
    abortDueToMultipleListeners();
  }
  process.on('uncaughtException', onUncaughtException);
  if (!allowMultipleUncaughtExceptionListeners) {
    process.on('newListener', onNewProcessListener);
  }

  function onUncaughtException(err) {
    reportSync(err);
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

function createReportObj(err) {
  var mem = process.memoryUsage();
  return {
    report: {
      uuid: makeUuid(),
      timestamp: (new Date()).getTime(),
      lang: "nodejs",
      langVersion: process.version,
      attributes: {
        "process.age": Math.floor(process.uptime() * 1000),
        "uname.machine": process.arch,
        "uname.sysname": process.platform,
        "classifiers": err.name,
        "error.message": err.message,
        "vm.rss.size": mem.rss,
        "gc.heap.total": mem.heapTotal,
        "gc.heap.used": mem.heapUsed,
        "hostname": os.hostname(),
      },
      env: process.env,
    },
    stack: err.stack,
    tabWidth: tabWidth,
    endpoint: endpoint,
    token: token,
  };
}

function reportAsync(err) {
  var payload = createReportObj(err);
  var asyncReportJs = path.join(__dirname, "async_report.js");
  var args = [asyncReportJs];
  if (debugBacktrace) args.push("--debug");
  var stdioValue = debugBacktrace ? 'inherit' : 'ignore';
  var payloadString = JSON.stringify(payload);

  var child = spawn(process.execPath, args, {
    timeout: timeout,
    stdio: ['pipe', stdioValue, stdioValue],
    encoding: 'utf8',
    detached: !debugBacktrace,
  });
  child.stdin.write(payloadString);
  child.stdin.end();
  if (!debugBacktrace) child.unref();
}

function reportSync(err) {
  var payload = createReportObj(err);
  var syncReportJs = path.join(__dirname, "sync_report.js");
  var args = [syncReportJs];
  if (debugBacktrace) args.push("--debug");
  var stdioValue = debugBacktrace ? 'inherit' : 'ignore';
  var payloadString = JSON.stringify(payload);

  spawnSync(process.execPath, args, {
    input: payloadString,
    timeout: timeout,
    stdio: [null, stdioValue, stdioValue],
    encoding: 'utf8',
  });
}
