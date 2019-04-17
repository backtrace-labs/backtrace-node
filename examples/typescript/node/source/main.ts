import { BacktraceClient, BacktraceClientOptions } from 'backtrace-node';
import * as fs from 'fs';

/**
 * To initialize new BacktraceClient you can use two methods:
 * 1. initialize(opts: BacktraceClientOptions);
 * 2. create manually BacktraceClient by typing new
 * You can check how to use #1 option in our electron demo
 * In this sample application I will use BacktraceClient instead
 */

const opts = {
  endpoint: 'submit.backtrace.io/universe/token/json',
} as BacktraceClientOptions;
const client = new BacktraceClient(opts);

/**
 * For different evnrionment you want to skip some amount of reports
 * Or set rate limit per minute. In this case we suggest to use options
 * sampling and rateLimit to setup limits that Backtrace library will use
 */

const rateOptions = {
  endpoint: 'submit.backtrace.io/universe/token/json',
  rateLimit: 100,
  sampling: 10,
} as BacktraceClientOptions;

/**
 * BacktraceCLient allows you to memorize application state
 * All data that you store via memorize method
 * will be added to next report and then removed from BacktraceCLient
 */

client.memorize('hi', 'hello');

/**
 * To create new report, you can use createReport method.
 * To send report to Backtrace you can use sendReport method
 */

const report = client.createReport('string parameter', { report: 'attributes' }, ['file', 'attachment', 'paths']);
client.sendReport(report);

/**
 * We know you prefer better and faster way to sending reports to Backtrace
 * Because of that we prepare some shortcuts for you!
 * You can pass exception object and send it to Backtrace via reportSync or reportAsync methods
 */

try {
  fs.readFileSync('path to not existing file');
} catch (err) {
  /**
   * reportSync and reportAsync methods returns BacktracResult
   * that tells you if Backtrace library was able to send correctly report to server
   */
  client.reportAsync(err, { attr: 'attr' }, ['file', 'path']).then((result) => {
    console.log(result);
  });

  const syncResult = client.reportSync(err);
  console.log(syncResult);
}

/**
 * If you like event emmiter you can use 'on' method to handle specific events
 * Supported events:
 * - 'before-send' - We emit this event when backtraceClient receive new report to send
 * - 'after-send' - We emit this event each time when we send data to Backtrace server
 * - 'before-data-send' -  We emit this event when we're ready to send data to Backtrace and we collect all usefull information
 * - 'rate-limit' - We emit this event when library hit rate limit per minute
 * - 'sampling-hit - We emit this event each time when sampling condition hit
 */

client.on('before-data-send', (report, data) => {
  console.log(JSON.stringify(data));
});
