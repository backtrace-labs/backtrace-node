const bt = require('.//lib');

bt.initialize({
  endpoint: `https://submit.backtrace.io/yolo/328174ab5c377e2cdcb6c763ec2bbdf1f9aa5282c1f6bede693efe06a479db54/json?_mod_sync=1`,
  token: '328174ab5c377e2cdcb6c763ec2bbdf1f9aa5282c1f6bede693efe06a479db54',
});

bt.reportSync(new Error('not implemented exception'));
