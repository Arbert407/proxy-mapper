import { app } from 'electron';
import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_SIZE = 5 * 1024 * 1024;

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let currentSize = 0;
let logPath: string | null = null;
let chain: Promise<void> = Promise.resolve();

async function ensurePath(): Promise<string> {
  if (logPath) return logPath;
  const logsDir = join(app.getPath('userData'), 'logs');
  await mkdir(logsDir, { recursive: true });
  logPath = join(logsDir, 'app.log');
  const stats = await stat(logPath).catch(() => null);
  currentSize = stats?.size ?? 0;
  return logPath;
}

async function rotateIfNeeded(): Promise<void> {
  if (currentSize < MAX_SIZE || !logPath) return;
  const rotatedPath = `${logPath}.1`;
  await rename(logPath, rotatedPath).catch(() => {});
  logPath = null;
  await ensurePath();
}

async function writeLine(level: Level, message: string): Promise<void> {
  await rotateIfNeeded();
  const path = await ensurePath();
  const ts = new Date().toISOString();
  const line = `${ts} [${level}] ${message}\n`;
  await appendFile(path, line, 'utf8');
  currentSize += Buffer.byteLength(line, 'utf8');
}

function enqueue(level: Level, message: string): void {
  chain = chain.then(() => writeLine(level, message)).catch(() => {});
}

export const logger = {
  debug: (msg: string) => enqueue('DEBUG', msg),
  info: (msg: string) => enqueue('INFO', msg),
  warn: (msg: string) => enqueue('WARN', msg),
  error: (msg: string) => enqueue('ERROR', msg),
  flush: () => chain,
};
