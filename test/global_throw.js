var bt = require('../');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
});

setTimeout(crash, 1);

var notAFunction;

function crash() {
  notAFunction();
}
