import { BacktraceClient, BacktraceClientOptions } from 'backtrace-node';
import { app, BrowserWindow } from 'electron';

let win: BrowserWindow;

console.log(app);
const backtraceClient = new BacktraceClient({
  endpoint: 'https:///submit.backtrace.io/tokenToYourInstace',
} as BacktraceClientOptions);

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 500,
    darkTheme: true,
  });

  win.on('close', () => {
    console.log('window is closing');
  });
  app.setBadgeCount(1);
}
try {
  app.on('ready', createWindow);
  app.on('activate', () => {
    if (win === null) {
      createWindow();
    }
  });
} catch (e) {
  console.error(e);
}
