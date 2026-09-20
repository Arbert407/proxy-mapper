/**
 * ipc.ts - Registro centralizado de handlers IPC del main.
 *
 * US-053: handlers proxy:start / proxy:stop (puente main ↔ renderer).
 * US-054+: añadirá emisión de proxy:state.
 */
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { startProxy, stopProxy } from './proxy';

/**
 * Verifica que el IPC venga de un webContents asociado a una de nuestras
 * BrowserWindows.
 *
 * Defensa en profundidad — NO es un límite estricto contra XSS en el
 * renderer (un script malicioso ahí pasa el check). Sirve para filtrar
 * llamadas de webContents huérfanos o procesos externos.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error('IPC sender no autorizado (sin BrowserWindow padre)');
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('proxy:start', (event) => {
    assertTrustedSender(event);
    return startProxy();
  });

  ipcMain.handle('proxy:stop', (event) => {
    assertTrustedSender(event);
    return stopProxy();
  });
}
