var bt = require('../');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
  contextLineCount: 1,
  disableGlobalHandler: true,
});

// this comment should not be included in source
// this comment should be included
main();

function main() {
  f1();
}

function f1() {
  f2();
}

function f2() {
  bt.report(new Error("here"));
}
// this comment should not be included in source
