/**
 * logs.ts - Buffer FIFO de líneas del proxy + emisión al renderer.
 *
 * US-056: stdout + stderr del child → buffer + IPC `logs:append`.
 * US-062: tope configurable (5000 líneas) + helpers clear/read (aún no usados).
 */
import type { LogEntry } from '../shared/types';
import { parseLogLevel } from '../shared/log-parser';
import { emitLogAppend } from './state-emitter';

const MAX_BUFFER = 5000;

const buffer: LogEntry[] = [];

export function getLogsBuffer(): readonly LogEntry[] {
  return buffer;
}

export function clearLogsBuffer(): void {
  buffer.length = 0;
}

/**
 * Agrega una línea cruda al buffer y la emite al renderer.
 * Sanea `\r` final (CRLF de Windows) y descarta líneas vacías.
 */
export function appendLogLine(rawLine: string): void {
  const message = rawLine.replace(/\r$/, '');
  if (message.length === 0) return;

  const entry: LogEntry = {
    level: parseLogLevel(message),
    message,
    timestamp: new Date().toISOString(),
  };

  buffer.push(entry);
  while (buffer.length > MAX_BUFFER) buffer.shift();

  emitLogAppend(entry);
}
