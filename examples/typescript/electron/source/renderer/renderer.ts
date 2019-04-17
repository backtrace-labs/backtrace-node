import { ipcRenderer } from 'electron';

const invokeMain = document.getElementById('invokeMain') as HTMLButtonElement;
const invokeMain2 = document.getElementById('invokeMain2') as HTMLButtonElement;
const crashProcess = document.getElementById('crashProcess') as HTMLButtonElement;

invokeMain.addEventListener('click', (e) => {
  ipcRenderer.send('invoke-main');
});

invokeMain2.addEventListener('click', (e) => {
  ipcRenderer.send('invoke-main-2');
});

crashProcess.addEventListener('click', (e) => {
  ipcRenderer.send('crash-process');
});
