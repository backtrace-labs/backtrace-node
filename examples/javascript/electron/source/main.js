const bt = require('backtrace-node');
const electron = require('electron');
const fs = require('fs');
const path = require('path');

function ElectronExample() {
  this.initializeRemoteLogging = function() {
    const token = 'token';
    const endpoint = `https://submit.backtrace.io/universe/${token}`;
    this._backtraceClient = bt.initialize({
      endpoint: endpoint + '/json',
      timeout: 20000,
    });

    electron.crashReporter.start({
      productName: 'Your product name',
      companyName: 'My Company, Inc',
      submitURL: endpoint + '/minidump',
      uploadToServer: true,
    });
  };

  this.readDataFromFileStorage = async function() {
    this._backtraceClient.memorize('ipc-method::invoke-main', this);
    try {
      this._backtraceClient.memorize('ipc-method::invoke-main', 'before reading');
      this.readFile();
    } catch (e) {
      await this._backtraceClient.reportAsync(
        e,
        {
          attribute: 'attribute',
          numberAttribute: 123132,
          foo: false,
        },
        ['path', 'to', 'my', 'files'],
      );
    }
  };

  function forwardMessage(msg) {
    this.ipcReply(msg);
  }
  function ipcReply(msg) {
    electron.ipcRenderer.send(msg);
  }

  function readFile() {
    fs.readFileSync('path to not existing file');
  }

  this.invokeInvalidIpcCommunication = async function() {
    try {
      this.forwardMessage('msg');
    } catch (err) {
      await this._backtraceClient.reportAsync(err);
    }
  };
}

async function createWindow() {
  win = new electron.BrowserWindow({
    width: 400,
    height: 500,
    darkTheme: true,
  });
  win.loadURL(path.join(__dirname, 'renderer', 'index.html'));

  electron.app.setBadgeCount(1);
  electron.ipcMain.on('invoke-main', async () => {
    await electronExample.readDataFromFileStorage();
  });

  electron.ipcMain.on('invoke-main-2', async () => {
    await electronExample.invokeInvalidIpcCommunication();
  });

  electron.ipcMain.on('crash-process', () => {
    process.crash();
  });
}

const electronExample = new ElectronExample();
electronExample.initializeRemoteLogging();
let win;

electron.app.on('ready', createWindow);
electron.app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
