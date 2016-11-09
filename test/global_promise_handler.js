var bt = require('../');
var port = parseInt(process.argv[2], 10);
var token = process.argv[3];

bt.initialize({
  endpoint: "http://localhost:" + port,
  token: token,
  handlePromises: true,
});

var p = new Promise(function(resolve, reject) {
  setTimeout(rejectThePromise, 1);
  function rejectThePromise() {
    reject(new Error("wrong person is president"));
  }
});
p.then(noop);

function noop() {}
