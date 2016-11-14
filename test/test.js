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
  {
    name: "global throw",
    fn: testGlobalThrow,
    path: "global_throw.js",
  },
  {
    name: "global promise handler",
    fn: testGlobalPromiseHandler,
    path: "global_promise_handler.js",
  },
  {
    name: "report object with request",
    fn: testRequestReportObject,
    path: "request_report_object.js",
  },
];

runOneTest(0);

function runOneTest(testIndex) {
  var testCase = testCases[testIndex];
  if (!testCase) return allTestsDone();

  console.error("Testing " + testCase.name + "...");

  var server = http.createServer();
  server.listen(0, "localhost", onListening);

  function onListening() {
    var jsPath = path.join(__dirname, testCase.path);
    fs.readFile(jsPath, {encoding: 'utf8'}, onReadFile);

    function onReadFile (err, contents) {
      if (err) throw err;

      server.on('request', onRequest);

      var port = server.address().port;
      var token = crypto.randomBytes(16).toString('hex');
      var args = [jsPath, port, token];
      var stdioAction = argv.isDebug ? 'inherit' : 'ignore';
      var child = spawn(process.execPath, args, { stdio: stdioAction});
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
            if (err) throw err;
            clearTimeout(timeoutInterval);
            response.statusCode = 200;
            response.write("OK");
            response.end();
            server.close(runNextTest);
          }
        }
      }
    }

    function timeRanOut() {
      console.error("FAIL: Timed out.");
      process.exit(1);
    }
  }

  function runNextTest() {
    runOneTest(testIndex + 1);
  }
}

function allTestsDone() {
  console.error("OK: All tests passed.");
}

function parseArgv(args) {
  var result = {
    isDebug: false,
  };
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
    "Usage: node test.js [options]\n" +
    "\n" +
    "Options:" +
    "  --debug        print verbose debug output");
  process.exit(1);
}

function testGlobalThrow(child, server, request, json, contents, callback) {
  assert.strictEqual(json.lang, "nodejs");
  assert.strictEqual(json.agent, "backtrace-node");
  assert.strictEqual(json.attributes['error.message'], "notAFunction is not a function");
  assert.strictEqual(objFirstValue(json.sourceCode).text,
    'function crash() {\n  notAFunction();\n}\n');
  callback();
}

function testGlobalPromiseHandler(child, server, request, json, contents, callback) {
  assert.strictEqual(json.lang, "nodejs");
  assert.strictEqual(json.agent, "backtrace-node");
  assert.strictEqual(json.attributes['error.message'], "wrong person is president");
  assert.strictEqual(objFirstValue(json.sourceCode).text, contents);
  callback();
}

function testRequestReportObject(child, server, request, json, contents, callback) {
  assert.strictEqual(json.lang, "nodejs");
  assert.strictEqual(json.agent, "backtrace-node");
  assert.strictEqual(json.attributes['error.message'], "RIP");
  assert.strictEqual(typeof(json.attributes.endTime), 'number');
  assert.ok(json.attributes.endTime >= json.attributes.startTime);
  assert.strictEqual(json.attributes.url, '/path');
  assert.strictEqual(json.attributes.method, 'GET');
  assert.strictEqual(objFirstValue(json.sourceCode).text, contents);
  callback();
}

function objFirstValue(object) {
  for (var key in object) {
    return object[key];
  }
}
