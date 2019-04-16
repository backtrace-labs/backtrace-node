"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// import { BacktraceClient } from '../../../../src';
// import { BacktraceClientOptions } from '../../../../src/model/backtraceClientOptions';
var win;
// const backtraceClient = new BacktraceClient({
//   endpoint: 'path to your endpoint',
// } as BacktraceClientOptions);
function createWindow() {
    win = new electron_1.BrowserWindow({
        width: 400,
        height: 500,
        darkTheme: true,
    });
    win.on('close', function () {
        console.log('window is closing');
    });
    electron_1.app.setBadgeCount(1);
}
try {
    electron_1.app.on('ready', createWindow);
    electron_1.app.on('activate', function () {
        if (win === null)
            createWindow();
    });
}
catch (e) {
    console.error(e);
}
