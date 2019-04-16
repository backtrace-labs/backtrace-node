import { app, BrowserWindow } from 'electron';
// import { BacktraceClient } from '../../../../src';
// import { BacktraceClientOptions } from '../../../../src/model/backtraceClientOptions';

let win: BrowserWindow;

// const backtraceClient = new BacktraceClient({
//   endpoint: 'path to your endpoint',
// } as BacktraceClientOptions);

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
    if (win === null) { createWindow(); }
  });
} catch (e) {
  console.error(e);
}
