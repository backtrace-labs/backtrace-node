# backtrace-node

[Backtrace](http://backtrace.io/) error reporting tool for Node.js.

## Usage

```js
var bt = require('backtrace.io');
bt.initialize({
  endpoint: "https://console.backtrace.io",
  token: "51cc8e69c5b62fa8c72dc963e730f1e8eacbd243aeafc35d08d05ded9a024121",
});

// ...

bt.report(new Error("something broke"));
```

## Documentation

### bt.initialize([options])

This is intended to be one of the first things your application does during
initialization. It registers a handler for `uncaughtException` which will
spawn a detached child process to perform the error report and then crash
in the same way that your application would have crashed without the handler.

#### Options

##### `endpoint`

Required.

Example: `https://backtrace.example.com:1234`.

Sets the HTTP/HTTPS endpoint that error reports will be sent to.

##### `token`

Required.

Example: `51cc8e69c5b62fa8c72dc963e730f1e8eacbd243aeafc35d08d05ded9a024121`.

Sets the token that will be used for authentication when sending an error
report.

##### `attributes`

Optional. Object that contains additional attributes to be sent along with the
error report.

Example:

```
{
    application: "ApplicationName",
    serverId: "foo",
}
```

##### `timeout`

Defaults to `1000`. Maximum amount of milliseconds to wait for child process
to process error report and schedule sending the report to Backtrace.

##### `debugBacktrace`

Defaults to `false`. Set to `true` to cause process to wait for the report to
Backtrace to complete before exiting.

##### `allowMultipleUncaughtExceptionListeners`

Defaults to `false`. Set to `true` to not crash when another `uncaughtException`
listener is detected.

##### `disableGlobalHandler`

Defaults to `false`. If this is `false`, this module will attach an
`uncaughtException` handler and report those errors automatically before
re-throwing the exception.

Set to `true` to disable this. Note that in this case the only way errors
will be reported is if you call `bt.report(error)`.

##### `contextLineCount`

Defaults to `20`. When an error is reported, this many lines above and below
each stack function are included in the report.

NOTE: this option is not yet implemented as currently all source code for files
in the stack trace are sent in the report.

##### `tabWidth`

Defaults to `8`. If there are any hard tabs in the source code, it is unclear
how many spaces they should be indented to correctly display the source code.
Therefore the error report can override this number to specify how many spaces
a hard tab should be represented by when viewing source code.

### bt.report(error)

Send an error report to Backtrace.

`error` should be an `Error` object created with `new Error("message")`.
