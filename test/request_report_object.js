var http = require('http');
var bt = require('../');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];
var StreamSink = require('streamsink');

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
});

var server = http.createServer();

server.listen(0, "localhost", function() {
  var port = server.address().port;
  server.on('request', function(request, response) {
    var report = bt.createReport();
    report.addObjectAttributes(request);
    report.addAttribute("startTime", new Date().getTime());
    var sink = new StreamSink();
    sink.on('finish', function() {
      report.addAttribute("endTime", new Date().getTime());
      report.setError(new Error("RIP"));
      report.send();
      response.end();
    });
    request.pipe(sink);
  });

  http.get("http://localhost:" + port + "/path", function(resp) {
    server.close();
  });
});
