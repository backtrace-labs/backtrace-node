var fs = require('fs');
var Pend = require('pend');
var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');
var spawn = require('child_process').spawn;
var readSourceFile = require('source-scan').scanFile;
var clean = require('./util').clean;

var stackLineRe = /\s+at (.+) \((.+):(\d+):(\d+)\)/;
var whichHttpLib = { 'http:': http, 'https:': https };

var memInfoRe = /^(.+):\s+(\d+)\s*(.+)?$/;
var memInfoToAttr = {
  'MemTotal': 'system.memory.total',
  'MemFree': 'system.memory.free',
  'MemAvailable': 'system.memory.available',
  'Buffers': 'system.memory.buffers',
  'Cached': 'system.memory.cached',
  'SwapCached': 'system.memory.swap.cached',
  'Active': 'system.memory.active',
  'Inactive': 'system.memory.inactive',
  'SwapTotal': 'system.memory.swap.total',
  'SwapFree': 'system.memory.swap.free',
  'Dirty': 'system.memory.dirty',
  'Writeback': 'system.memory.writeback',
  'Slab': 'system.memory.slab',
  'VmallocTotal': 'system.memory.vmalloc.total',
  'VmallocUsed': 'system.memory.vmalloc.used',
  'VmallocChunk': 'system.memory.vmalloc.chunk',
};

module.exports = sendReport;

const SUBMIT_SERVICE_HOSTNAME = 'submit.backtrace.io';

function isSubmitService(url) {
  return url.hostname == SUBMIT_SERVICE_HOSTNAME;
}

function errorIfDebug(info, line) {
  if (info.isDebug) {
    console.error(line);
  }
}

function sendReport(info, cb) {
  var pend = new Pend();
  pend.go(function(cb) {
    parseStack(info, cb);
  });
  pend.go(function(cb) {
    obtainMemInfo(info, cb);
  });
  pend.go(function(cb) {
    obtainUnameInfo(info, cb);
  });
  pend.wait(gotAllInfo);

  function gotAllInfo(err) {
    if (err)
      return cb(err);

    var report = info.report;
    errorIfDebug(info, JSON.stringify(report, null, 2));

    var parsedEndpoint = url.parse(info.endpoint);
    var httpLib = whichHttpLib[parsedEndpoint.protocol];
    if (!httpLib)
      return cb(new Error('Invalid URL'));

    var postString = JSON.stringify(report);
    var postData = new Buffer(postString, 'utf8');

    var query = querystring.stringify(
      clean({ token: info.token, format: 'json' }),
    );

    /*
     * if using the backtrace submit service, we do not 
     * modify path
     */
    parsedEndpoint.path = isSubmitService(parsedEndpoint)
      ? parsedEndpoint.path
      : '/post?' + query;

    parsedEndpoint.method = 'POST';
    parsedEndpoint.headers = {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
    };

    var req = httpLib.request(parsedEndpoint, onResponse);
    req.on('error', onError);
    req.write(postData);
    req.end();

    function onResponse(resp) {
      if (resp.statusCode === 200)
        return cb();
      cb(new Error('HTTP ' + resp.statusCode));
    }

    function onError(err) {
      if (err.code === 'ECONNRESET') {
        cb(new Error(
          'Unable to send report: ' + info.endpoint + ' reset the connection',
        ));
        return;
      }
      cb(err);
    }
  }
}

function parseStackLines(stackList) {
  var lines = [];
  for (var i = stackList.length - 1; i >= 0; i -= 1) {
    lines = lines.concat(stackList[i].split('\n').slice(1));
  }
  return lines;
}

function parseStack(info, cb) {
  var lines = parseStackLines(info.stackList);
  var report = info.report;
  var tabWidth = info.tabWidth;
  var contextLineCount = info.contextLineCount;
  var filterFilePath = info.filterFilePath;
  var stackArray = [];
  var wantedSourceCode = {};
  for (var i = 0; i < lines.length; i += 1) {
    var rawLine = lines[i];
    var match = rawLine.match(stackLineRe);
    if (!match)
      continue;

    var funcName = match[1];
    var sourceCodePath = match[2];
    var line = parseInt(match[3], 10);
    var column = parseInt(match[4], 10);

    if (sourceCodePath === filterFilePath)
      continue;

    wantedSourceCode[sourceCodePath] = wantedSourceCode[sourceCodePath] || [];
    wantedSourceCode[sourceCodePath].push({ line: line, column: column });

    var frame = {
      funcName: funcName,
      line: line,
      column: column,
      sourceCode: sourceCodePath,
      library: sourceCodePath,
    };
    stackArray.push(frame);
  }

  report.threads = { main: { stack: stackArray } };
  report.mainThread = 'main';
  resolveSourceCode(
    report,
    tabWidth,
    contextLineCount,
    wantedSourceCode,
    info,
    onResolvedSourceCode,
  );

  function onResolvedSourceCode(err) {
    if (err)
      return cb(err);

    // Delete references to source code entries that don't exist.
    for (var i = 0; i < report.threads.main.stack.length; i += 1) {
      var frame = report.threads.main.stack[i];
      if (frame.sourceCode && !report.sourceCode[frame.sourceCode]) {
        delete frame.sourceCode;
      }
    }

    cb();
  }
}

function resolveSourceCode(
  report,
  tabWidth,
  contextLineCount,
  wantedSourceCode,
  info,
  cb,
) {
  report.sourceCode = {};

  var pend = new Pend();
  for (var sourceCodePath in wantedSourceCode) {
    if (sourceCodePath[0] !== '/')
      continue;

    var wantedLinesList = wantedSourceCode[sourceCodePath];
    var minLine = wantedLinesList[0].line;
    var maxLine = minLine;
    for (var i = 1; i < wantedLinesList.length; i += 1) {
      var item = wantedLinesList[i];
      minLine = Math.min(minLine, item.line);
      maxLine = Math.max(maxLine, item.line);
    }
    pend.go(makeReadFn(sourceCodePath, minLine, maxLine));
  }
  pend.wait(cb);

  function makeReadFn(sourceCodePath, minLine, maxLine) {
    return readFn;

    function readFn(cb) {
      var startLine = Math.max(minLine - 1 - contextLineCount, 0);
      var endLine = maxLine + contextLineCount;
      var options = {
        filePath: sourceCodePath,
        startLine: startLine,
        endLine: endLine,
      };
      readSourceFile(options, onReadFinished);

      function onReadFinished(err, buf) {
        if (err) {
          errorIfDebug(
            info,
            'Unable to read \'' + sourceCodePath + '\': ' + err.message,
          );
          // Don't report an error here. We can allow some fs lookups to fail and
          // still have a useful report.
          cb();
          return;
        }
        report.sourceCode[sourceCodePath] = {
          path: sourceCodePath,
          startLine: startLine + 1,
          startColumn: 1,
          text: buf.toString('utf8'),
          tabWidth: tabWidth,
        };
        cb();
      }
    }
  }
}

function throwIfErr(err) {
  if (err)
    throw err;
}

function obtainMemInfo(info, cb) {
  fs.readFile('/proc/meminfo', { encoding: 'utf8' }, onReadFinished);

  function onReadFinished(err, contents) {
    if (err) {
      errorIfDebug(info, 'Unable to read /proc/meminfo: ' + err.message);
      // Don't report an error here. We can allow obtaining meminfo to fail
      // and still have a useful report.
      cb();
      return;
    }

    var lines = contents.split('\n');
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (!line)
        continue;
      var match = line.match(memInfoRe);
      if (!match) {
        errorIfDebug(
          info,
          'unrecognized line in /proc/meminfo: \'' + line + '\'',
        );
        continue;
      }
      var name = match[1];
      var number = parseInt(match[2], 10);
      var units = match[3];
      var attrName = memInfoToAttr[name];
      if (!attrName)
        continue;
      if (number === 0)
        units = 'B';
      if (units === 'B' || units === 'bytes') {
        number *= 1;
      } else if (units === 'kB') {
        number *= 1024;
      } else {
        errorIfDebug(
          info,
          'unrecognized units in /proc/meminfo: \'' + units + '\'',
        );
        continue;
      }
      info.report.attributes[attrName] = number;
    }

    cb();
  }
}

function obtainUnameInfo(info, cb) {
  var pend = new Pend();
  pend.go(makeCollectUnameFn(info, '-m', 'uname.machine'));
  pend.go(makeCollectUnameFn(info, '-r', 'uname.release'));
  pend.go(makeCollectUnameFn(info, '-s', 'uname.sysname'));
  pend.go(makeCollectUnameFn(info, '-v', 'uname.version'));
  pend.wait(cb);
}

function makeCollectUnameFn(info, unameArg, attrName, cb) {
  return function(cb) {
    collectStdout('uname', [ unameArg ], function(err, stdout) {
      if (err) {
        errorIfDebug(
          info,
          'Unable to exec uname ' + unameArg + ': ' + err.message,
        );
        // Don't report an error here. We can allow obtaining uname info to fail
        // and still have a useful report.
        cb();
        return;
      }
      info.report.attributes[attrName] = stdout.trim();
      cb();
    });
  };
}

function collectStdout(cmd, args, cb) {
  var child = spawn(cmd, args, {
    timeout: 1000,
    stdio: [ 'ignore', 'pipe', 'inherit' ],
    encoding: 'utf8',
  });
  var stdout = '';
  child.on('error', cb);
  child.stdout.on('data', function(data) {
    stdout += data;
  });
  child.on('close', function(code, signal) {
    if (code) {
      cb(new Error(cmd + ' exited with code ' + code));
      return;
    }
    if (signal) {
      cb(new Error(cmd + ' exited with signal ' + signal));
      return;
    }
    cb(null, stdout);
  });
}

