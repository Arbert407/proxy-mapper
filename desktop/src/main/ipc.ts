/**
 * ipc.ts - Registro centralizado de handlers IPC del main.
 *
 * - US-053: handlers proxy:start / proxy:stop.
 * - US-063: handler logs:clear (limpia buffer FIFO en main + snapshot del renderer).
 * - US-064: handler logs:save (diálogo nativo + writeFile).
 * - US-092: handlers mappings:read / mappings:write (editor de pares).
 * - US-095: handlers mappings:export / mappings:import (diálogo nativo + TSV).
 */
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { writeFile } from 'node:fs/promises';
import { startProxy, stopProxy } from './proxy';
import { clearLogsBuffer, getLogsBuffer } from './logs';
import {
  exportMappingsToFile,
  importMappingsFromFile,
  readMappings,
  writeMappings,
} from './mappings';
import { logger } from './logger';

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

  ipcMain.handle('logs:read', (event) => {
    assertTrustedSender(event);
    return getLogsBuffer();
  });

  ipcMain.handle('logs:clear', (event) => {
    assertTrustedSender(event);
    logger.info('logs:clear: vaciando buffer FIFO en main');
    clearLogsBuffer();
    return { ok: true };
  });

  ipcMain.handle('logs:save', async (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error('logs:save: sin BrowserWindow padre para el diálogo');
      return { ok: false, reason: 'no_window' };
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `proxy-mapper-logs-${ts}.txt`;
    const dlg = await dialog.showSaveDialog(win, {
      title: 'Guardar logs del proxy',
      defaultPath: defaultName,
      filters: [
        { name: 'Texto', extensions: ['txt'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });

    if (dlg.canceled || !dlg.filePath) {
      logger.info('logs:save: cancelado por el usuario');
      return { ok: false, reason: 'canceled' };
    }

    try {
      const buffer = getLogsBuffer();
      const content = buffer.map((e) => `${e.timestamp} ${e.message}`).join('\n');
      await writeFile(dlg.filePath, content, 'utf8');
      logger.info(`logs:save: ${buffer.length} líneas escritas en ${dlg.filePath}`);
      return { ok: true, path: dlg.filePath };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`logs:save: error al escribir ${dlg.filePath}: ${reason}`);
      return { ok: false, reason };
    }
  });

  ipcMain.handle('mappings:read', async (event) => {
    assertTrustedSender(event);
    return readMappings();
  });

  ipcMain.handle('mappings:write', async (event, pairs) => {
    assertTrustedSender(event);
    return writeMappings(pairs);
  });

  ipcMain.handle('mappings:export', async (event, pairs) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error('mappings:export: sin BrowserWindow padre para el diálogo');
      return { ok: false, reason: 'no_window' };
    }
    return exportMappingsToFile(win, pairs);
  });

  ipcMain.handle('mappings:import', async (event) => {
    assertTrustedSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error('mappings:import: sin BrowserWindow padre para el diálogo');
      return { ok: false, reason: 'no_window' };
    }
    return importMappingsFromFile(win);
  });
}
