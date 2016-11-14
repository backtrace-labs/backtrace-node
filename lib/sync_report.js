var spawn = require('child_process').spawn;
var StreamSink = require('streamsink');
var path = require('path');

// The job of this process is to input all stdin, spawn async_report.js
// detached, passing it all the data, and exit as quickly as possible.
// This is to work around the fact that the process using index.js must
// wait for this process to exit before restarting in the event of a
// crash.

main();

function main() {
  var isDebug = false;
  for (var i = 2; i < process.argv.length; i += 1) {
    var arg = process.argv[i];
    if (arg === "--debug") {
      isDebug = true;
    } else {
      console.error("Invalid argument: " + arg + "\n");
      usage();
    }
  }

  collectStdin(isDebug);
}

function usage() {
  console.error(
    "Usage: " + process.argv[0] + " " + process.argv[1] + " [options]\n" +
    "Options:\n" +
    "  --debug      Show debug output from reporting");
  process.exit(1);
}

function collectStdin(isDebug) {
  var sink = new StreamSink();
  sink.on('finish', gotAllStdin);
  process.stdin.pipe(sink);

  function gotAllStdin() {
    var asyncReportJs = path.join(__dirname, "async_report.js"); 
    var stdioAction = isDebug ? 'inherit' : 'ignore';
    var isDetached = !isDebug;
    var args = [asyncReportJs];
    if (isDebug) args.push("--debug");
    var child = spawn(process.execPath, args, {
      detached: isDetached,
      stdio: ['pipe', stdioAction, stdioAction],
    });
    sink.createReadStream().pipe(child.stdin);
    if (isDetached) {
      child.unref();
    }
  }
}
