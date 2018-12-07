var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var spawn = require('child_process').spawn;
var path = require('path');
var assert = require('assert');
var StreamSink = require('streamsink');

var argv = parseArgv(process.argv);

var timeout = 2000;
var testCases = [
  { name: 'global throw', fn: testGlobalThrow, path: 'global_throw.js' },
  {
    name: 'global promise handler',
    fn: testGlobalPromiseHandler,
    path: 'global_promise_handler.js',
  },
  {
    name: 'report object with request',
    fn: testRequestReportObject,
    path: 'request_report_object.js',
  },
  {
    name: 'min and max lines of source code',
    fn: testMinMaxSourceLine,
    path: 'source_code_max_line.js',
  },
  { name: 'tracing', fn: testTracing, path: 'tracing.js' },
];

runOneTest(0);

function runOneTest(testIndex) {
  var testCase = testCases[testIndex];
  if (!testCase)
    return allTestsDone();

  console.error('Testing ' + testCase.name + '...');

  var server = http.createServer();
  server.listen(0, 'localhost', onListening);

  function onListening() {
    var jsPath = path.join(__dirname, testCase.path);
    fs.readFile(jsPath, { encoding: 'utf8' }, onReadFile);

    function onReadFile(err, contents) {
      if (err)
        throw err;

      server.on('request', onRequest);

      var port = server.address().port;
      var token = crypto.randomBytes(16).toString('hex');
      var args = [ jsPath, port, token ];
      var stdioAction = argv.isDebug ? 'inherit' : 'ignore';
      var child = spawn(process.execPath, args, { stdio: stdioAction });
      var timeoutInterval = setTimeout(timeRanOut, timeout);

      function onRequest(request, response) {
        var sink = new StreamSink();
        sink.on('finish', gotFullRequest);
        request.pipe(sink);

        function gotFullRequest() {
          var body = sink.toString('utf8');
          var json = JSON.parse(body);
          testCase.fn(child, server, request, json, contents, testCaseDone);

          function testCaseDone(err) {
            if (err)
              throw err;
            clearTimeout(timeoutInterval);
            response.statusCode = 200;
            response.write('OK');
            response.end();
            server.close(runNextTest);
          }
        }
      }
    }

    function timeRanOut() {
      console.error('FAIL: Timed out.');
      process.exit(1);
    }
  }

  function runNextTest() {
    runOneTest(testIndex + 1);
  }
}

function allTestsDone() {
  console.error('OK: All tests passed.');
}

function parseArgv(args) {
  var result = { isDebug: false };
  for (var i = 2; i < args.length; i += 1) {
    var arg = args[i];
    if (arg === '--debug') {
      result.isDebug = true;
    } else {
      return usage();
    }
  }
  return result;
}

function usage() {
  console.error(
    'Usage: node test.js [options]\n' + '\n' + 'Options:' +
      '  --debug        print verbose debug output',
  );
  process.exit(1);
}

function testGlobalThrow(child, server, request, json, contents, callback) {
  assert.strictEqual(json.lang, 'nodejs');
  assert.strictEqual(json.agent, 'backtrace-node');
  assert.strictEqual(
    json.attributes['error.message'],
    'notAFunction is not a function',
  );
  assert.strictEqual(
    objFirstValue(json.sourceCode).text,
    'function crash() {\n  notAFunction();\n}\n',
  );
  assert.strictEqual(json.threads.main.stack[0].line, 17);
  assert.strictEqual(json.threads.main.stack[0].column, 3);
  assert.strictEqual(json.classifiers[0], 'TypeError');

  // If you update package.json of backtrace-node you'll have to additionally update these tests.
  var dependencies = json.annotations.Dependencies;
  assert.ok(dependencies.pend.requestedVersion.startsWith('~1.2.'));
  assert.ok(dependencies.pend.installedVersion.startsWith('1.2.'));
  assert.ok(dependencies['source-scan'].requestedVersion.startsWith('~1.0.'));
  assert.ok(dependencies['source-scan'].installedVersion.startsWith('1.0.'));
  assert.ok(
    dependencies['source-scan'].dependencies.streamsink.requestedVersion.startsWith(
      '~1.2.',
    ),
  );
  assert.ok(
    dependencies['source-scan'].dependencies.streamsink.installedVersion.startsWith(
      '1.2.',
    ),
  );

  callback();
}

function testGlobalPromiseHandler(
  child,
  server,
  request,
  json,
  contents,
  callback,
) {
  assert.strictEqual(json.lang, 'nodejs');
  assert.strictEqual(json.agent, 'backtrace-node');
  assert.strictEqual(
    json.attributes['error.message'],
    'wrong person is president',
  );
  assert.strictEqual(objFirstValue(json.sourceCode).text, contents);
  assert.strictEqual(json.threads.main.stack[0].line, 14);
  assert.strictEqual(json.threads.main.stack[0].column, 12);
  assert.strictEqual(json.classifiers[0], 'Error');

  // If you update package.json of backtrace-node you'll have to additionally update these tests.
  var dependencies = json.annotations.Dependencies;
  assert.ok(dependencies.pend.requestedVersion.startsWith('~1.2.'));
  assert.ok(dependencies.pend.installedVersion.startsWith('1.2.'));
  assert.ok(dependencies['source-scan'].requestedVersion.startsWith('~1.0.'));
  assert.ok(dependencies['source-scan'].installedVersion.startsWith('1.0.'));
  assert.ok(
    dependencies['source-scan'].dependencies.streamsink.requestedVersion.startsWith(
      '~1.2.',
    ),
  );
  assert.ok(
    dependencies['source-scan'].dependencies.streamsink.installedVersion.startsWith(
      '1.2.',
    ),
  );

  callback();
}

function testRequestReportObject(
  child,
  server,
  request,
  json,
  contents,
  callback,
) {
  assert.strictEqual(json.lang, 'nodejs');
  assert.strictEqual(json.agent, 'backtrace-node');
  assert.strictEqual(json.attributes['error.message'], 'RIP');
  assert.strictEqual(typeof json.attributes.endTime, 'number');
  assert.ok(json.attributes.endTime >= json.attributes.startTime);
  assert.strictEqual(json.attributes.url, '/path');
  assert.strictEqual(json.attributes.method, 'GET');
  assert.strictEqual(objFirstValue(json.sourceCode).text, contents);
  assert.strictEqual(json.threads.main.stack[0].line, 25);
  assert.strictEqual(json.threads.main.stack[0].column, 23);
  assert.strictEqual(json.classifiers[0], 'Error');
  assert.deepEqual(json.annotations['Ad Hoc Annotation'], {
    one: [ 1, 2, 3 ],
    ok: true,
    derp: { field: 'str' },
    no: null,
  });
  assert.strictEqual(json.annotations.Log[0].msg, 'log line 1 { here: 123 }');
  assert.strictEqual(json.annotations.Log[1].msg, 'log line 2 true false');

  // If you update package.json of backtrace-node you'll have to additionally update these tests.
  var dependencies = json.annotations.Dependencies;
  assert.ok(dependencies.pend.requestedVersion.startsWith('~1.2.'));
  assert.ok(dependencies.pend.installedVersion.startsWith('1.2.'));
  assert.ok(dependencies['source-scan'].requestedVersion.startsWith('~1.0.'));
  assert.ok(dependencies['source-scan'].installedVersion.startsWith('1.0.'));
  assert.ok(dependencies.streamsink.requestedVersion.startsWith('~1.2.'));
  assert.ok(dependencies.streamsink.installedVersion.startsWith('1.2.'));

  callback();
}

function testMinMaxSourceLine(
  child,
  server,
  request,
  json,
  contents,
  callback,
) {
  assert.strictEqual(
    objFirstValue(json.sourceCode).text,
    '// this comment should be included\nmain();\n\nfunction main() {\n  f1();\n}\n\nfunction f1() {\n  f2();\n}\n\nfunction f2() {\n  bt.report(new Error("here"));\n}\n',
  );

  callback();
}

function testTracing(child, server, request, json, contents, callback) {
  assertStackContains(json, 'test/tracing.js', 11, null);
  assertStackContains(
    json,
    'test/tracing.js',
    15,
    'Timeout.one [as _onTimeout]',
  );
  assertStackContains(json, 'test/tracing.js', 19, 'two');
  assertStackContains(json, 'test/tracing.js', 30, null);

  var errProps = json.annotations['Error Properties'];
  assert.strictEqual(errProps.code, 'ECONNREFUSED');
  assert.strictEqual(errProps.errno, 'ECONNREFUSED');
  assert.strictEqual(errProps.syscall, 'connect');
  assert.strictEqual(errProps.address, '127.0.0.1');
  assert.strictEqual(errProps.port, 1234);

  callback();
}

function objFirstValue(object) {
  for (var key in object) {
    return object[key];
  }
}

function assertStackContains(json, file, line, func) {
  var stack = json.threads.main.stack;

  for (var i = 0; i < stack.length; i += 1) {
    var frame = stack[i];
    var sourceCodeId = frame.sourceCode;
    if (sourceCodeId == null)
      continue;
    if (frame.line == null)
      continue;
    if (frame.funcName == null && func != null)
      continue;
    var sourceCodePath = json.sourceCode[sourceCodeId].path;
    if (
      sourceCodePath.endsWith(file) &&
        (func == null || frame.funcName.startsWith(func)) &&
        frame.line === line
    ) {
      return;
    }
  }
  throw new Error('not found in stack: ' + file + ' ' + line + ' ' + func);
}
