var StreamSink = require('streamsink');

// This process must collect stdin and then close stdin as fast as possible,
// but then is free to take as long as it needs to perform the error reporting,
// since no user process is waiting on it.

main();

function main() {
  var sink = new StreamSink();
  sink.on('finish', gotAllStdin);
  process.stdin.pipe(sink);

  function gotAllStdin() {
    console.log("TODO write this to coronerd: (begin)");
    console.log(sink.toBuffer().toString('utf8'));
    console.log("(end)");
  }
}
