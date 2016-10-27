var crypto = require('crypto');
var child_process = require('child_process');
var spawnSync = child_process.spawnSync;
var spawn = child_process.spawn;
var path = require('path');
var os = require('os');
var fs = require('fs');

exports.initialize = initialize;
exports.report = reportAsync;

var debugBacktrace;
var timeout;
var tabWidth;
var endpoint;
var token;
var userAttributes;

var procSelfStatusData = [
  {
    re: /^nonvoluntary_ctxt_switches:\s+(\d+)$/m,
    parse: parseInt,
    attr: "sched.cs.involuntary",
  },
  {
    re: /^voluntary_ctxt_switches:\s+(\d+)$/m,
    parse: parseInt,
    attr: "sched.cs.voluntary",
  },
  {
    re: /^FDSize:\s+(\d+)$/m,
    parse: parseInt,
    attr: "descriptor.count",
  },
  {
    re: /^FDSize:\s+(\d+)$/m,
    parse: parseInt,
    attr: "descriptor.count",
  },
  {
    re: /^VmData:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.data.size",
  },
  {
    re: /^VmLck:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.locked.size",
  },
  {
    re: /^VmPTE:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.pte.size",
  },
  {
    re: /^VmHWM:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.rss.peak",
  },
  {
    re: /^VmRSS:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.rss.size",
  },
  {
    re: /^VmLib:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.shared.size",
  },
  {
    re: /^VmStk:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.stack.size",
  },
  {
    re: /^VmSwap:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.swap.size",
  },
  {
    re: /^VmPeak:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.vma.peak",
  },
  {
    re: /^VmSize:\s+(\d+)\s+kB$/m,
    parse: parseKb,
    attr: "vm.vma.size",
  },
];

var rootPackageJson = getRootPackageJson();

function initialize(options) {
  options = options || {};

  debugBacktrace = !!options.debugBacktrace;
  timeout = options.timeout || 1000;
  tabWidth = options.tabWidth || 8;
  endpoint = options.endpoint;
  token = options.token;
  userAttributes = extend({}, options.attributes || {});

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
  var payload = {
    report: {
      uuid: makeUuid(),
      timestamp: (new Date()).getTime() / 1000,
      lang: "nodejs",
      langVersion: process.version,
      attributes: extend({
        "process.age": Math.floor(process.uptime() * 1000),
        "uname.machine": process.arch,
        "uname.sysname": process.platform,
        "classifiers": err.name,
        "error.message": err.message,
        "vm.rss.size": mem.rss,
        "gc.heap.total": mem.heapTotal,
        "gc.heap.used": mem.heapUsed,
        "hostname": os.hostname(),
      }, userAttributes),
      env: process.env,
    },
    stack: err.stack,
    tabWidth: tabWidth,
    endpoint: endpoint,
    token: token,
  };
  if (rootPackageJson && !payload.report.attributes.application) {
    payload.report.attributes.application = rootPackageJson.name;
  }
  obtainProcSelfStatus(payload.report);
  return payload;
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

function obtainProcSelfStatus(report) {
  // Justification for doing this synchronously:
  // * We need to collect this information in the process uncaughtException handler, in which the
  //   event loop is not safe to use.
  // * We are collecting a snapshot of virtual memory used. If this is done asynchronously, then
  //   we may pick up virtual memory information for a time different than the moment we are
  //   interested in.
  // * procfs is a virtual filesystem; there is no disk I/O to block on. It's synchronous anyway.
  var contents;
  try {
    contents = fs.readFileSync("/proc/self/status", {encoding: 'utf8'});
  } catch (err) {
    errorIfDebug("Unable to read /proc/self/status: " + err.message);
    return;
  }
  for (var i = 0; i < procSelfStatusData.length; i += 1) {
    var item = procSelfStatusData[i];
    var match = contents.match(item.re);
    if (!match) {
      errorIfDebug("Unable to extract " + item.attr);
      continue;
    }
    report.attributes[item.attr] = item.parse(match[1]);
  }
}

function errorIfDebug(line) {
  if (!debugBacktrace) return;
  console.error(line);
}

function extend(o, src) {
  for (var key in src) o[key] = src[key];
  return o;
}

function getRootPackageJson() {
  var rootFilename = require.main.filename;
  var searchDir = path.dirname(rootFilename);

  // Traverse upwards until we find package.json.
  while (true) {
    var searchFilename = path.join(searchDir, "package.json");
    var packageJson;
    try {
      packageJson = require(searchFilename);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        var prevSearchDir = searchDir;
        searchDir = path.dirname(searchDir);
        if (searchDir === prevSearchDir) {
          errorIfDebug("No root package.json found");
          return null;
        }
        continue;
      } else {
        errorIfDebug("Unable to obtain root package.json: " + err.message);
        return null;
      }
    }
    return packageJson;
  }
}

function parseKb(str) {
  return parseInt(str) * 1024;
}
