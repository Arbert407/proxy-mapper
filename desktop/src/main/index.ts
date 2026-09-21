import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { bindMainWindow } from './state-emitter';
import { logger } from './logger';
import { isProxyRunning, stopProxy } from './proxy';
import { readVersions } from './version';

// US-073: AppUserModelId debe coincidir con `appId` de electron-builder.yml.
// Sin esto, Windows agrupa el icono del taskbar bajo "Electron" en vez de
// "Proxy Mapper" y muestra el icono genérico de Electron en vez de icon.ico.
app.setAppUserModelId('com.anomaly.proxy-mapper-desktop');

// US-083: graceful shutdown — antes de cerrar la app, detener el proxy con
// SIGTERM (US-051) y esperar hasta 5s (FORCE_KILL_TIMEOUT_MS en proxy.ts)
// antes de permitir que el proceso muera. El flag evita re-entrada si
// `app.quit()` vuelve a disparar `before-quit` tras el stop.
let isQuitting = false;
app.on('before-quit', (event) => {
  if (!isProxyRunning() || isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  logger.info('before-quit: proxy vivo, deteniendo antes de salir');
  void stopProxy()
    .then((result) => {
      if (!result.ok) {
        logger.error(`before-quit: stopProxy falló (${result.reason}), saliendo igual`);
      }
    })
    .finally(() => {
      app.quit();
    });
});

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    title: 'Proxy Mapper',
    // US-073: icono de la ventana (en dev, el .exe aún no existe; en prod
    // el del .exe toma precedencia pero este sirve para el splash inicial).
    icon: join(__dirname, '../../resources/icon.ico'),
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
