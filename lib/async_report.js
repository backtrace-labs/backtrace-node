var StreamSink = require('streamsink');
var sendReport = require('./send_report');

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
    sendReport(info, cb);
  }
}

function throwIfErr(err) {
  if (err) throw err;
}
