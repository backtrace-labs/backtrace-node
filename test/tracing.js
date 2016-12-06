var bt = require('../');
var net = require('net');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
});

var report = bt.createReport();
setTimeout(one, 1);

function one() {
  two();
}

function two() {
  report.trace();
  setTimeout(three, 1);
}

function three() {
  four();
}

function four() {
  var client = net.connect(1234, "127.0.0.1");
  client.on('error', function(err) {
    report.setError(err);
    report.send();
  });
}
