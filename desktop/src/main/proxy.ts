/**
 * proxy.ts - Lifecycle del proxy heredado.
 *
 * - US-050: spawn inicial de `npm.cmd run dev`.
 * - US-051: stop con SIGTERM + escalación a `taskkill /f` tras 5s.
 * - US-052: mutex en memoria (`child !== null` + flag `stopInProgress`).
 * - US-053: handlers IPC en `main/ipc.ts`.
 * - US-054: emite `proxy:state` al renderer en cada transición.
 * - US-055: detecta crash (exit ≠ 0 / 'error') y emite `'crashed'`.
 * - US-056: pipea stdout/stderr del child al buffer de logs + IPC.
 * - US-057: `cwd` resuelve en dev (parent) o producción (`process.resourcesPath/proxy`).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { app } from 'electron';
import { PROXY_SPAWN_OPTIONS } from './constants';
import { appendLogLine } from './logs';
import { logger } from './logger';
import { emitProxyState } from './state-emitter';

export type StartResult =
  | { ok: true; pid: number }
  | { ok: false; reason: string };

export type StopResult =
  | { ok: true }
  | { ok: false; reason: string };

const FORCE_KILL_TIMEOUT_MS = 5000;

let child: ChildProcess | null = null;
let stopInProgress = false;

export function isProxyRunning(): boolean {
  return child !== null;
}

/**
 * Resuelve el directorio donde vive el proyecto proxy (con `index.js`).
 *
 * - Dev:    `resolve(app.getAppPath(), '..')` — wrapper vive en `desktop/`,
 *           proxy en la raíz del repo.
 * - Prod:   `join(process.resourcesPath, 'proxy')` — asume que US-072
 *           empaqueta los archivos del proxy como `extraResources: proxy/`.
 */
function resolveAppRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'proxy');
  }
  return resolve(app.getAppPath(), '..');
}

function pipeChildStream(stream: NodeJS.ReadableStream | null, source: 'stdout' | 'stderr'): void {
  if (!stream) return;
  const rl = createInterface({ input: stream });
  rl.on('line', (line) => appendLogLine(line));
  // El readline se cierra cuando el stream cierra; no necesitamos .close() explícito.
  void source;
}

function emitCrashed(reason: string): void {
  logger.error(`proxy: crashed — ${reason}`);
  emitProxyState({ state: 'crashed', reason });
}

export async function startProxy(): Promise<StartResult> {
  // Mutex (US-052): rechaza si ya hay un proceso vivo o un stop en curso.
  if (child !== null || stopInProgress) {
    return { ok: false, reason: 'already_running' };
  }

  const appRoot = resolveAppRoot();
  const entry = join(appRoot, 'index.js');
  if (!existsSync(entry)) {
    const reason = `index.js no encontrado en ${appRoot}`;
    logger.error(`startProxy: ${reason}`);
    return { ok: false, reason };
  }

  emitProxyState({ state: 'starting' });

  try {
    const spawned = spawn('npm.cmd', ['run', 'dev'], {
      cwd: appRoot,
      ...PROXY_SPAWN_OPTIONS,
    });
    child = spawned;

    const pid = spawned.pid ?? -1;
    logger.info(`startProxy: proxy arrancado (pid=${pid}) en ${appRoot}`);

    // US-056: pipear stdout/stderr al buffer + IPC.
    pipeChildStream(spawned.stdout, 'stdout');
    pipeChildStream(spawned.stderr, 'stderr');

    // US-055: listeners para detectar crash / exit normal.
    spawned.on('exit', (code, signal) => {
      logger.info(
        `startProxy: child exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
      );
      if (child === spawned) child = null;
      if (stopInProgress || code === 0 || code === null) {
        emitProxyState({ state: 'off' });
      } else {
        const reasonStr = `Exit code ${code}${signal ? ` (signal ${signal})` : ''}`;
        emitCrashed(reasonStr);
      }
    });

    spawned.on('error', (err) => {
      if (child === spawned) child = null;
      emitCrashed(err.message);
    });

    emitProxyState({ state: 'running' });
    return { ok: true, pid };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`startProxy: fallo al spawnar: ${reason}`);
    emitProxyState({ state: 'off', reason });
    return { ok: false, reason };
  }
}

export async function stopProxy(): Promise<StopResult> {
  if (child === null) {
    return { ok: false, reason: 'not_running' };
  }
  if (stopInProgress) {
    return { ok: false, reason: 'stop_in_progress' };
  }
  stopInProgress = true;

  const target = child;
  emitProxyState({ state: 'stopping' });

  try {
    if (target.exitCode !== null || target.signalCode !== null) {
      logger.info(
        `stopProxy: child ya terminado (exit=${target.exitCode}, signal=${target.signalCode})`,
      );
      return { ok: true };
    }

    return await new Promise<StopResult>((resolve) => {
      let resolved = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (result: StopResult) => {
        if (resolved) return;
        resolved = true;
        if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
        resolve(result);
      };

      target.once('exit', () => {
        logger.info(`stopProxy: proxy terminado (pid=${target.pid ?? '?'})`);
        finish({ ok: true });
      });

      try {
        target.kill();
        logger.info(`stopProxy: kill signal enviado a pid=${target.pid ?? '?'}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.error(`stopProxy: fallo al enviar kill: ${reason}`);
        finish({ ok: false, reason });
        return;
      }

      forceKillTimer = setTimeout(() => {
        const pid = target.pid;
        if (pid === undefined) {
          finish({ ok: false, reason: 'force_kill_no_pid' });
          return;
        }
        logger.warn(
          `stopProxy: no terminó en ${FORCE_KILL_TIMEOUT_MS}ms, escalando a taskkill /f (pid=${pid})`,
        );
        const tk = spawn(
          'taskkill',
          ['/pid', String(pid), '/t', '/f'],
          PROXY_SPAWN_OPTIONS,
        );
        tk.once('exit', (code) => {
          if (code !== 0) {
            logger.error(`stopProxy: taskkill /f salió con código ${code}`);
          }
        });
        tk.once('error', (err) => {
          logger.error(`stopProxy: taskkill /f error: ${err.message}`);
        });
      }, FORCE_KILL_TIMEOUT_MS);
    });
  } finally {
    stopInProgress = false;
  }
}
