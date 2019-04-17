import { BacktraceClientOptions, initialize, reportAsync, reportSync, getBacktraceClient } from 'backtrace-node';
import { app, BrowserWindow, crashReporter, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

function initializeRemoteLogging() {
  const token = 'd272507e493f159ffae0baca421cb43157cbc3ea99fed4fc5e4726bd3cd6763f';
  const endpoint = `https:///submit.backtrace.io/yolo/${token}`;
  initialize({
    endpoint: endpoint + '/json',
    timeout: 20000,
  } as BacktraceClientOptions);

  crashReporter.start({
    productName: 'Your product name',
    companyName: 'My Company, Inc',
    submitURL: endpoint + '/minidump',
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
  setupCallbacks();
}

function readFile() {
  fs.readFileSync('path to not existing file');
}

async function invokeInvalidMethod() {
  try {
    readFile();
  } catch (e) {
    const client = getBacktraceClient();
    const result = await client.reportAsync(
      e,
      {
        attribute: 'attribute',
        numberAttribute: 123132,
        foo: false,
      },
      ['path', 'to', 'my', 'files'],
    );

    console.log(result);
  }
}

function setupCallbacks() {
  ipcMain.on('invoke-main', async () => {
    await invokeInvalidMethod();
  });

  ipcMain.on('invoke-main-2', async () => {
    await invokeInvalidMethod();
  });

  ipcMain.on('crash-process', () => {
    process.crash();
  });
}

initializeRemoteLogging();

let win: BrowserWindow;

app.on('ready', createWindow);
app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
