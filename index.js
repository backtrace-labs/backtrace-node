var crypto = require('crypto');
var spawnSync = require('child_process').spawnSync;
var path = require('path');

exports.initialize = initialize;

function initialize(options) {
  options = options || {};
  var allowMultipleUncaughtExceptionListeners = !!options.allowMultipleUncaughtExceptionListeners;
  var debugBacktrace = !!options.debugBacktrace;

  if (!allowMultipleUncaughtExceptionListeners &&
      process.listenerCount('uncaughtException') !== 0)
  {
    throw new Error("Backtrace: multiple 'uncaughtException' listeners attached.");
  }
  process.on('uncaughtException', onUncaughtException);
  if (!allowMultipleUncaughtExceptionListeners) {
    process.on('newListener', onNewProcessListener);
  }
  
  function onUncaughtException(err) {
    // TODO parse err.stack
    var report = {
      uuid: makeUuid(),
      timestamp: (new Date()).getTime(),
      lang: "nodejs",
      langVersion: process.version,
      uptime: process.uptime(),
      env: process.env,
      os: process.platform,
      memoryUsage: process.memoryUsage(),
      errorName: err.name,
      errorMessage: err.message,
    };

    var syncReportJs = path.join(__dirname, "sync_report.js"); 
    var args = [syncReportJs];
    if (debugBacktrace) {
      args.push("--debug");
    }
    var stdioValue = debugBacktrace ? 'inherit' : 'ignore';
    var reportString = JSON.stringify(report);

    spawnSync(process.execPath, args, {
      input: reportString,
      timeout: options.timeout || 1000,
      stdio: [null, 'inherit', 'inherit'],
      encoding: 'utf8'
    });

    throw err;
  }

  function onNewProcessListener(eventName, listener) {
    if (eventName === 'uncaughtException') {
      throw new Error("Backtrace: multiple 'uncaughtException' listeners attached.");
    }
  }
}

function makeUuid() {
  return crypto.pseudoRandomBytes(16).toString('base64');
}
