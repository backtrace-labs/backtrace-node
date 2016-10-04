# node-backtrace.io

[Backtrace](http://backtrace.io/) error reporting tool.

## Usage

```js
var bt = require('backtrace.io');
bt.initialize();
```

## Documentation

```js
bt.initialize([options]);
```

### Options

#### `timeout`

Defaults to `1000`. Maximum amount of milliseconds to wait for child process
to process error report and schedule sending the report to Backtrace.

#### `debugBacktrace`

Defaults to `false`. Set to `true` to cause process to wait for the report to
Backtrace to complete before exiting.
