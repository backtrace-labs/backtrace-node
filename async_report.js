var fs = require('fs');
var StreamSink = require('streamsink');
var Pend = require('pend');
var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');

var stackLineRe = /\s+at (.+) \((.+):(\d+):(\d+)\)/;
var whichHttpLib = {
  'http:': http,
  'https:': https,
};

// This process must collect stdin and then close stdin as fast as possible,
// but then is free to take as long as it needs to perform the error reporting,
// since no user process is waiting on it.

main(throwIfErr);

function main(cb) {
  var sink = new StreamSink();
  sink.on('finish', gotAllStdin);
  process.stdin.pipe(sink);

  function gotAllStdin() {
    var payload = sink.toBuffer().toString('utf8');
    var info = JSON.parse(payload);
    var report = info.report;

    parseStack(info, finishedParsingStack);

    function finishedParsingStack(err) {
      if (err) return cb(err);
      sendReport(report, info.endpoint, info.token, cb);
    }
  }
}

function sendReport(report, endpoint, token, cb) {
  var parsedEndpoint = url.parse(endpoint);
  var httpLib = whichHttpLib[parsedEndpoint.protocol];
  if (!httpLib) return cb(new Error("Invalid URL"));

  var postString = JSON.stringify(report);
  var postData = Buffer.from(postString, 'utf8');

  var query = querystring.stringify({
    token: token,
    format: "json",
  });

  parsedEndpoint.path = "/post?" + query;
  parsedEndpoint.method = "POST";
  parsedEndpoint.headers = {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
  };
  var req = httpLib.request(parsedEndpoint, onResponse);
  req.on('error', cb);
  req.write(postData);
  req.end();

  function onResponse(resp) {
    if (resp.statusCode == 200) return cb();
    var err = new Error("HTTP " + resp.statusCode);
    cb(err);
  }
}

function parseStack(info, cb) {
  var stack = info.stack;
  var report = info.report;
  var tabWidth = info.tabWidth;
  var lines = stack.split("\n").slice(1);
  var stackArray = [];
  var wantedSourceCode = {};
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i];
    var match = line.match(stackLineRe);
    if (!match) continue;

    var procName = match[1];
    var sourceCodePath = match[2];
    var line = match[3];
    var column = match[4];
    wantedSourceCode[sourceCodePath] = wantedSourceCode[sourceCodePath] || [];
    wantedSourceCode[sourceCodePath].push({line: line, column: column});

    var frame = {
      procName: procName,
      line: line,
      column: column,
      sourceCode: sourceCodePath,
      library: sourceCodePath,
    };
    stackArray.push(frame);
  }

  report.threads = {
    main: {
      stack: stackArray,
    },
  };
  report.mainThread = "main";
  resolveSourceCode(report, tabWidth, wantedSourceCode, onResolvedSourceCode);

  function onResolvedSourceCode(err) {
    if (err) return cb(err);

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

function resolveSourceCode(report, tabWidth, wantedSourceCode, cb) {
  report.sourceCode = {};

  var pend = new Pend();
  for (var sourceCodePath in wantedSourceCode) {
    if (sourceCodePath[0] !== '/') continue;

    pend.go(makeReadFn(sourceCodePath));
  }
  pend.wait(cb);

  function makeReadFn(sourceCodePath) {
    return readFn;

    function readFn(cb) {
      fs.readFile(sourceCodePath, {encoding: 'utf8'}, onReadFinished);

      function onReadFinished(err, contents) {
        if (err) {
          console.error("Unable to read '" + sourceCodePath + "': " + err.message);
          // Don't report an error here. We can allow some fs lookups to fail and
          // still have a useful report.
          cb();
          return;
        }
        report.sourceCode[sourceCodePath] = {
          path: sourceCodePath,
          startLine: 0,
          startColumn: 0,
          startPos: 0,
          text: contents,
          tabWidth: tabWidth,
        };
        cb();
      }
    }
  }
}

function throwIfErr(err) {
  if (err) throw err;
}

