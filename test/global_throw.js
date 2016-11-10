var bt = require('../');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
  contextLineCount: 1,
});

setTimeout(crash, 1);

var notAFunction;

// this comment should not be included in source
function crash() {
  notAFunction();
}
// this comment should not be included in source
