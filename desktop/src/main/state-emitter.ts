/**
 * state-emitter.ts - Emisión de cambios del proxy al renderer.
 *
 * US-054: `proxy:state` (cambios de estado del lifecycle).
 * US-056: `logs:append` (líneas de log del proxy).
 */
import { BrowserWindow, type WebContents } from 'electron';
import type { LogEntry, ProxyStateChange } from '../shared/types';
import { logger } from './logger';

let target: WebContents | null = null;

export function bindMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    target = win.webContents;
    logger.info(`bindMainWindow: target seteado (win id=${win.id})`);
  } else {
    logger.warn(`bindMainWindow: no hay ventanas todavía`);
  }
}

function send<T>(channel: string, payload: T): void {
  if (!target || target.isDestroyed()) {
    target = null;
    logger.warn(`send(${channel}): target es null o destruido`);
    return;
  }
  target.send(channel, payload);
}

export function emitProxyState(change: ProxyStateChange): void {
  send('proxy:state', change);
}

export function emitLogAppend(entry: LogEntry): void {
  logger.info(`emitLogAppend: enviando logs:append (msg=${entry.message.substring(0, 60)})`);
  send('logs:append', entry);
}
