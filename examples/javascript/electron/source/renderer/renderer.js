const electron = require('electron');

const invokeMain = document.getElementById('invokeMain');
const invokeMain2 = document.getElementById('invokeMain2');
const crashProcess = document.getElementById('crashProcess');

invokeMain.addEventListener('click', (e) => {
  electron.ipcRenderer.send('invoke-main');
});

invokeMain2.addEventListener('click', (e) => {
  electron.ipcRenderer.send('invoke-main-2');
});

crashProcess.addEventListener('click', (e) => {
  electron.ipcRenderer.send('crash-process');
});
