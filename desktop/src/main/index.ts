import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { bindMainWindow } from './state-emitter';
import { readVersions } from './version';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    title: 'Proxy Mapper',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('app:version', () => readVersions(__dirname));
  registerIpcHandlers();
  createWindow();
  bindMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
