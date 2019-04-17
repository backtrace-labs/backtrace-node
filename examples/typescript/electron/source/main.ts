import { BacktraceClient, BacktraceClientOptions, initialize } from 'backtrace-node';
import { app, BrowserWindow, crashReporter, ipcMain, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class ElectronExample {
  private _backtraceClient!: BacktraceClient;

  public initializeRemoteLogging() {
    const token = 'd272507e493f159ffae0baca421cb43157cbc3ea99fed4fc5e4726bd3cd6763f';
    const endpoint = `https://submit.backtrace.io/yolo/${token}`;
    this._backtraceClient = initialize({
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

  public async readDataFromFileStorage(): Promise<void> {
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
  }

  public async invokeInvalidIpcCommunication(): Promise<void> {
    try {
      this.forwardMessage('msg');
    } catch (err) {
      this._backtraceClient.reportAsync(err);
    }
  }
  private forwardMessage(msg: string) {
    this.ipcReply(msg);
  }
  private ipcReply(msg: string) {
    ipcRenderer.send(msg);
  }

  private readFile() {
    fs.readFileSync('path to not existing file');
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 500,
    darkTheme: true,
  });
  win.loadURL(path.join(__dirname, 'renderer', 'index.html'));

  app.setBadgeCount(1);
  setupCallbacks();
}

const electronExample = new ElectronExample();
electronExample.initializeRemoteLogging();

function setupCallbacks() {
  ipcMain.on('invoke-main', async () => {
    await electronExample.readDataFromFileStorage();
  });

  ipcMain.on('invoke-main-2', async () => {
    await electronExample.invokeInvalidIpcCommunication();
  });

  ipcMain.on('crash-process', () => {
    process.crash();
  });
}

let win: BrowserWindow;

app.on('ready', createWindow);
app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
