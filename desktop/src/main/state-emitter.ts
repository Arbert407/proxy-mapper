/**
 * state-emitter.ts - Emisión de cambios del proxy al renderer.
 *
 * US-054: `proxy:state` (cambios de estado del lifecycle).
 * US-056: `logs:append` (líneas de log del proxy).
 */
import { BrowserWindow, type WebContents } from 'electron';
import type { LogEntry, ProxyStateChange } from '../shared/types';

let target: WebContents | null = null;

export function bindMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    target = win.webContents;
  }
}

function send<T>(channel: string, payload: T): void {
  if (!target || target.isDestroyed()) {
    target = null;
    return;
  }
  target.send(channel, payload);
}

export function emitProxyState(change: ProxyStateChange): void {
  send('proxy:state', change);
}

export function emitLogAppend(entry: LogEntry): void {
  send('logs:append', entry);
}
