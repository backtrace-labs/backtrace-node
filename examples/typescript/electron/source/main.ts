import { BacktraceClient, BacktraceClientOptions, BtReport, IBacktraceData, initialize } from 'backtrace-node';
import { app, BrowserWindow, crashReporter, ipcMain, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class ElectronExample {
  private _backtraceClient!: BacktraceClient;

  public initializeRemoteLogging() {
    const token = 'token';
    const endpoint = `https://submit.backtrace.io/universe/${token}`;
    this._backtraceClient = initialize({
      endpoint: endpoint + '/json',
      timeout: 20000,
    });

    crashReporter.start({
      productName: 'Your product name',
      companyName: 'My Company, Inc',
      submitURL: endpoint + '/minidump',
      uploadToServer: true,
    });
  }

  public async readDataFromFileStorage(): Promise<void> {
    try {
      this._backtraceClient.memorize('ipc-method::invoke-main', 'before reading');
      this.readFile();
    } catch (e) {
      this._backtraceClient.memorize('ipc-method::invoke-main-err', 'error');
      this._backtraceClient.on('before-data-send', (report: BtReport, data: IBacktraceData) => {
        const attributes = data.attributes;
        console.log(attributes);
      });
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
