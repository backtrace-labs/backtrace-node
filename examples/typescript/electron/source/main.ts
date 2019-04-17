import { BacktraceClientOptions, initialize } from 'backtrace-node';
import { app, BrowserWindow, crashReporter } from 'electron';
import * as path from 'path'

function initializeRemoteLogging() {
  const token = 'tokenToYourInstace';
  const endpoint = `https:///submit.backtrace.io/${token}`;
  initialize({
    endpoint,
  } as BacktraceClientOptions);

  crashReporter.start({
    productName: 'Your product name',
    companyName: 'My Company, Inc',
    submitURL: endpoint,
    uploadToServer: true,
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 500,
    darkTheme: true,
  });
  win.loadURL(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.openDevTools();

  win.on('close', () => {
    process.crash();
  });
  app.setBadgeCount(1);
}

initializeRemoteLogging();

let win: BrowserWindow;

app.on('ready', createWindow);
app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
