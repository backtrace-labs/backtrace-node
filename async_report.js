var fs = require('fs');
var StreamSink = require('streamsink');
var Pend = require('pend');
var http = require('http');
var https = require('https');
var url = require('url');

var stackLineRe = /\s+at (.+) \((.+):(\d+):(\d+)\)/;

// This process must collect stdin and then close stdin as fast as possible,
// but then is free to take as long as it needs to perform the error reporting,
// since no user process is waiting on it.

main();

function main() {
  var sink = new StreamSink();
  sink.on('finish', gotAllStdin);
  process.stdin.pipe(sink);

  function gotAllStdin() {
    var payload = sink.toBuffer().toString('utf8');
    var info = JSON.parse(payload);
    var report = info.report;

    parseStack(info, finishedParsingStack);
  }

}

  function finishedParsingStack(err, report) {
    if (err) throw err;

    console.log("TODO write this to coronerd: (begin)");
    console.log(JSON.stringify(report, null, 2));
    console.log("(end)");
  }

http://127.0.0.1:6097/post?token=51cc8e69c5b62fa8c72dc963e730f1e8eacbd243aeafc35d08d05ded9a024121&format=json

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

    cb(null, report);
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
