var crypto = require('crypto');
var child_process = require('child_process');
var spawnSync = child_process.spawnSync;
var spawn = child_process.spawn;
var path = require('path');
var os = require('os');
var fs = require('fs');
var sendReport = require('./send_report');

exports.initialize = initialize;
exports.report = reportAsync;
exports.reportSync = reportSync;
exports.createReport = createReport;
exports.BacktraceReport = BacktraceReport;

// populated in bt.initialize
var initialized = false;
var debugBacktrace;
var timeout;
var tabWidth;
var endpoint;
var token;
var userAttributes;
var contextLineCount;
var rootPackageJson;

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

var syncReportJs = path.join(__dirname, "sync_report.js");
var asyncReportJs = path.join(__dirname, "async_report.js");
var rootModule = getRootModule();
var myPackageJson = require('../package.json');

function initialize(options) {
  options = options || {};

  debugBacktrace = !!options.debugBacktrace;
  timeout = options.timeout || 1000;
  tabWidth = options.tabWidth || 8;
  endpoint = options.endpoint;
  token = options.token;
  userAttributes = extend({}, options.attributes || {});
  contextLineCount = options.contextLineCount || 200;

  var disableGlobalHandler = !!options.disableGlobalHandler;
  var handlePromises = !!options.handlePromises;

  if (!endpoint) throw new Error("Backtrace: missing 'endpoint' option.");
  if (!token) throw new Error("Backtrace: missing 'token' option.");

  if (!disableGlobalHandler) {
    registerGlobalHandler(!!options.allowMultipleUncaughtExceptionListeners);
  }
  if (handlePromises) {
    registerPromiseHandler();
  }

  rootPackageJson = fetchModulePackageJson(rootModule);
  initialized = true;
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

function registerPromiseHandler() {
  process.on('unhandledRejection', function(err) {
    var callback = debugBacktrace ? null : noop;
    reportAsync(err, callback);
  });
}

function noop() {}

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

function getTimestamp() {
  return Math.floor((new Date()).getTime() / 1000)
}

function getUptime() {
  return Math.floor(process.uptime());
}

function abortDueToMultipleListeners() {
  var err = new Error("Backtrace: multiple 'uncaughtException' listeners attached.");
  console.error(err.stack);
  process.exit(1);
}

function reportSync(arg1, arg2) {
  if (!initialized) throw new Error("Must call bt.initialize first");
  var err, attributes;
  if (arg1 instanceof Error) {
    err = arg1;
    if (typeof(arg2) === 'object') {
      attributes = arg2;
    } else if (arg2 != null) {
      throw new Error("expected object for second argument");
    }
  } else if (typeof(arg1) === 'object') {
    attributes = arg1;
    if (arg2 != null) throw new Error("expected nothing after attributes");
  } else if (arg1 != null) {
    throw new Error("expected Error or object for first argument");
  }

  var report = createReport();
  if (attributes) report.addObjectAttributes(attributes);
  if (err) report.setError(err);
  report.sendSync();
}

function reportAsync(arg1, arg2, arg3) {
  if (!initialized) throw new Error("Must call bt.initialize first");

  var err, attributes, callback;
  if (typeof(arg1) === 'function') {
    callback = arg1;
    if (arg2 != null) throw new Error("expected nothing after callback");
  } else if (arg1 instanceof Error) {
    err = arg1;
    if (typeof(arg2) === 'function') {
      callback = arg2;
      if (arg3 != null) throw new Error("expected nothing after callback");
    } else if (typeof(arg2) === 'object') {
      attributes = arg2;
      if (typeof(arg3) === 'function') {
        callback = arg3;
      } else if (arg3 != null) {
        throw new Error("expected function for third argument");
      }
    } else if (arg2 != null) {
      throw new Error("expected object or function for second argument");
    }
  } else if (typeof(arg1) === 'object') {
    attributes = arg1;
    if (typeof(arg2) === 'function') {
      callback = arg2;
      if (arg3 != null) throw new Error("expected nothing after callback");
    } else if (arg2 != null) {
      throw new Error("expected function for second argument");
    }
  } else if (arg1 != null) {
    throw new Error("expected Error, object, or function for first argument");
  }

  var report = createReport();
  if (attributes) report.addObjectAttributes(attributes);
  if (err) report.setError(err);
  report.send(callback);
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

function obtainModuleInfo(report) {
  // Justification for doing this synchronously:
  // * We need to collect this information in the process uncaughtException handler, in which the
  //   event loop is not safe to use.
  // * We use `require` to collect all the package.json info. This cost is only paid once.
  // * We need access to `require.cache` which means we cannot do it in a child process.
  if (!rootPackageJson) return;
  var dependencies = {};
  var count = 0;
  for (var modId in require.cache) {
    var mod = getRootModOfPkg(require.cache[modId]);
    if (!mod || mod === rootModule) continue;
    populateDependencyTree(dependencies, rootModule, rootPackageJson, mod);
    count += 1;
  }
  if (count > 0) report.dependencies = dependencies;
}

function errorIfDebug(line) {
  if (!debugBacktrace) return;
  console.error(line);
}

function extend(o, src) {
  for (var key in src) o[key] = src[key];
  return o;
}

function fetchModulePackageJson(mod) {
  // Traverse upwards until we find package.json.
  var searchDir = path.dirname(mod.filename);
  while (true) {
    try {
      var packageJsonPath = path.join(searchDir, "package.json");
      return require(packageJsonPath);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        var prevSearchDir = searchDir;
        searchDir = path.dirname(searchDir);
        if (searchDir === prevSearchDir) {
          errorIfDebug("Unable to find package.json for module " + mod.filename);
          return null;
        }
        continue;
      } else {
        errorIfDebug("Unable to find package.json for module " + mod.filename + ": " + err.message);
        return null;
      }
    }
  }
}

function populateDependencyTree(deps, rootModule, rootPackageJson, mod) {
  var stack = [];
  var curMod = mod;
  while (true) {
    var packageJson = fetchModulePackageJson(curMod);
    if (!packageJson) return;
    stack.push({
      mod: curMod,
      packageJson: packageJson,
    });
    curMod = getRootModOfPkg(curMod.parent);
    if (!curMod) return;
    if (curMod === rootModule) break;
  }
  var item;
  var curDeps = deps;
  var curParentJson = rootPackageJson;
  while (item = stack.pop()) {
    if (curDeps[item.packageJson.name]) {
      curDeps = curDeps[item.packageJson.name].dependencies;
    } else {
      var newDeps = {};
      curDeps[item.packageJson.name] = {
        requestedVersion: curParentJson.dependencies[item.packageJson.name],
        installedVersion: item.packageJson.version,
        dependencies: newDeps,
      };
      curDeps = newDeps;
    }
    curParentJson = item.packageJson;
  }
}

function getRootModOfPkg(mod) {
  var modPkgJson = fetchModulePackageJson(mod);
  if (!modPkgJson) return null;
  while (true) {
    var parentMod = mod.parent;
    if (!parentMod) return mod;
    var parentPkgJson = fetchModulePackageJson(parentMod);
    if (!parentPkgJson) return null;
    if (parentPkgJson !== modPkgJson) return mod;
    mod = parentMod;
  }
}

function getRootModule() {
  var mod = module;
  while (mod.parent) {
    mod = mod.parent;
  }
  return mod;
}

function parseKb(str) {
  return parseInt(str) * 1024;
}

function validateErrorObject(err) {
  if (err instanceof Error) return true;
  console.error(new Error("Attempted to report error with non Error type").stack);
  return false;
}

function isValidAttr(value) {
    return (typeof(value) === 'string' ||
            typeof(value) === 'boolean' ||
            typeof(value) === 'number');
}

function addAttrs(attributes, seenObjs, prefix, obj, allowPrivateProps) {
  if (seenObjs.has(obj)) return;
  seenObjs.add(obj);

  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    if (!allowPrivateProps && key[0] === '_') continue;
    var value = obj[key];
    if (isValidAttr(value)) {
      attributes[prefix + key] = value;
    } else if (!Array.isArray(value) && typeof(value) === 'object') {
      addAttrs(attributes, seenObjs, key + ".", value, allowPrivateProps);
    }
  }
}

function createReport() {
  return new BacktraceReport();
}

function BacktraceReport() {
  if (!initialized) throw new Error("Must call bt.initialize first");
  var mem = process.memoryUsage();
  this.payload = {
    report: {
      uuid: makeUuid(),
      timestamp: getTimestamp(),
      lang: "nodejs",
      langVersion: process.version,
      agent: myPackageJson.name,
      agentVersion: myPackageJson.version,
      attributes: extend({
        "process.age": getUptime(),
        "uname.machine": process.arch,
        "uname.sysname": process.platform,
        "vm.rss.size": mem.rss,
        "gc.heap.total": mem.heapTotal,
        "gc.heap.used": mem.heapUsed,
        "hostname": os.hostname(),
      }, userAttributes),
      env: process.env,
    },
    tabWidth: tabWidth,
    contextLineCount: contextLineCount,
    endpoint: endpoint,
    token: token,
    isDebug: debugBacktrace,
  };
  if (rootPackageJson && !this.payload.report.attributes.application) {
    this.payload.report.attributes.application = rootPackageJson.name;
  }
  obtainProcSelfStatus(this.payload.report);
  obtainModuleInfo(this.payload.report);
}

BacktraceReport.prototype.setError = function(err) {
  if (!validateErrorObject(err)) return;

  this.payload.report.attributes.classifiers = err.name;
  this.payload.report.attributes['error.message'] = err.message;
  this.payload.stack = err.stack;
};

BacktraceReport.prototype.send = function(callback) {
  sendReport(this.payload, function(err) {
    if (callback) {
      callback(err);
    } else if (err && debugBacktrace) {
      console.error(err.stack);
    }
  });
};

BacktraceReport.prototype.sendSync = function() {
  var args = [syncReportJs];
  if (debugBacktrace) args.push("--debug");
  var stdioValue = debugBacktrace ? 'inherit' : 'ignore';
  var payloadString = JSON.stringify(this.payload);

  spawnSync(process.execPath, args, {
    input: payloadString,
    timeout: timeout,
    stdio: [null, stdioValue, stdioValue],
    encoding: 'utf8',
  });
};

BacktraceReport.prototype.addAttribute = function(key, value) {
  if (!isValidAttr(value)) {
    console.error(new Error("Attempted to add attribute with invalid type '" +
      typeof(value) + "'").stack);
    return;
  }
  this.payload.report.attributes[key] = value;
};

BacktraceReport.prototype.addObjectAttributes = function(object, options) {
  options = options || {};
  var prefix = options.prefix || "";
  var allowPrivateProps = !!options.allowPrivateProps;
  addAttrs(this.payload.report.attributes, new Set(), prefix, object, allowPrivateProps);
};
