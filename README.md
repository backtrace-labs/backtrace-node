# backtrace-node

[Backtrace](http://backtrace.io/) error reporting tool for Node.js.

## Usage

```js
var bt = require('backtrace-node');
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

##### `handlePromises`

Optional. Set to `true` to listen to the `unhandledRejection` global event and
report those errors in addition to `uncaughtException` events.

Defaults to `false` because an application can technically add a promise
rejection handler after an event loop iteration, which would cause the
`unhandledRejection` event to fire, followed by the `rejectionHandled` event
when the handler was added later. This would make the error report a false
positive. However, most applications will add rejection handlers before an
event loop iteration, in which case `handlePromises` should be set to `true`.

##### `attributes`

Optional. Object that contains additional attributes to be sent along with
every error report. These can be overridden on an individual report with
`report.setAttribute`.

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

Defaults to `200`. When an error is reported, this many lines above and below
each stack function are included in the report.

NOTE: this option is not yet implemented as currently all source code for files
in the stack trace are sent in the report.

##### `tabWidth`

Defaults to `8`. If there are any hard tabs in the source code, it is unclear
how many spaces they should be indented to correctly display the source code.
Therefore the error report can override this number to specify how many spaces
a hard tab should be represented by when viewing source code.

### bt.report(error, [callback])

Sends an error report to the endpoint specified in `initialize`.

 * `error` - should be an `Error` object created with `new Error("message")`.
   If this parameter is not an instance of `Error` then backtrace-node will
   print a warning message to stderr.
 * `callback(err)` - optional. Called when the report is finished sending.

### bt.reportSync(error)

Same as `bt.report`, but blocks until finished.

### bt.createReport()

Create a report object that you can later choose whether or not to send.

This may be useful to track something like a request.

Returns a `BacktraceReport`.

### bt.BacktraceReport

Create a `BacktraceReport` object with `bt.createReport`.

Example:

```js
http.createServer(function(request, response) {
  var report = createReport();
  report.addObjectAttributes(request);

  // ...later...
  report.setError(new Error("something broke"));
  report.send();
});
```

#### report.addAttribute(key, value)

Adds an attribute to a specific report. Valid types for `value` are
`string`, `number`, and `boolean`.

#### report.addObjectAttributes(object, [options])

Adds all key-value pairs of `object` into the report recursively. For example:

```js
http.createServer(function(request, response) {
    report.addObjectAttributes(request);
});
```

In this example, the list of attributes added is:

```
readable = true
socket.readable = true
socket.writable = true
socket.allowHalfOpen = true
socket.destroyed = false
socket.bytesRead = 0
server.allowHalfOpen = true
server.pauseOnConnect = false
server.httpAllowHalfOpen = false
server.timeout = 120000
parser.maxHeaderPairs = 2000
socket.remoteAddress = "::ffff:127.0.0.1"
socket.remoteFamily = "IPv6"
socket.remotePort = 32958
socket.localAddress = "::ffff:127.0.0.1"
socket.localPort = 12345
socket.bytesWritten = 0
httpVersionMajor = 1
httpVersionMinor = 1
httpVersion = "1.1"
complete = false
headers.host = "localhost:12345"
headers.user-agent = "curl/7.47.0"
headers.accept = "*/*"
upgrade = false
url = "/"
method = "GET"
```

Available options:

 * `allowPrivateProps` Boolean. By default, keys that start with an underscore
   are ignored. If you pass `true` for `allowPrivateProps` then these keys are
   added.
 * `prefix` String. Defaults to `""`. You might consider passing `"foo."` to
   namespace the added attributes with `"foo."`.

#### report.send([callback])

Sends the error report to the endpoint specified in `initialize`.

 * `error` - should be an `Error` object created with `new Error("message")`.
   If this parameter is not an instance of `Error` then backtrace-node will
   print a warning message to stderr.
 * `callback(err)` - optional. Called when the report is finished sending.

#### report.sendSync()

Same as `report.send`, but blocks until finished.
