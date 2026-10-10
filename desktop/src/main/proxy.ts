/**
 * proxy.ts - Lifecycle del proxy heredado.
 *
 * - US-050 (desviado): en vez de `spawn('node', ['index.js'])` usamos
 *   `utilityProcess.fork()` de Electron. Beneficios:
 *   - No depende de `node.exe` instalado en el sistema del usuario (usa
 *     el Node.js embebido en Electron).
 *   - Hereda el package.json `"type": "module"` del padre para ESM.
 *   - Streams stdout/stderr accesibles vía `stdio: 'pipe'`.
 * - US-051: stop con SIGTERM + escalación a `taskkill /f` tras 5s.
 * - US-052: mutex en memoria (`child !== null` + flag `stopInProgress`).
 * - US-053: handlers IPC en `main/ipc.ts`.
 * - US-054: emite `proxy:state` al renderer en cada transición.
 * - US-055: detecta crash (exit ≠ 0 / 'error') y emite `'crashed'`.
 * - US-056: pipea stdout/stderr del child al buffer de logs + IPC.
 * - US-057: `cwd` resuelve en dev (parent) o producción (`userData/proxy/`
 *             via `ensureUserDataProxy()` — ver `proxy-bootstrap.ts`).
 */
import { spawn as nativeSpawn } from 'node:child_process';
import { utilityProcess, type UtilityProcess } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { app } from 'electron';
import { PROXY_SPAWN_OPTIONS } from './constants';
import { appendLogLine } from './logs';
import { logger } from './logger';
import { emitProxyState } from './state-emitter';
import { ensureUserDataProxy } from './proxy-bootstrap';

export type StartResult =
  | { ok: true; pid: number }
  | { ok: false; reason: string };

export type StopResult =
  | { ok: true }
  | { ok: false; reason: string };

const FORCE_KILL_TIMEOUT_MS = 5000;

let child: UtilityProcess | null = null;
let stopInProgress = false;

export function isProxyRunning(): boolean {
  return child !== null;
}

/**
 * Resuelve el directorio donde se va a forkear el proxy.
 *
 * - Dev:  `resolve(app.getAppPath(), '..')` — wrapper vive en `desktop/`,
 *         proxy en la raíz del repo. `mapping.tsv` vive ahi tambien.
 * - Prod: `userData/proxy/` — directorio writable por usuario. El wrapper
 *         copia `index.js` + `package.json` desde el asar al primer arranque
 *         (`ensureUserDataProxy()`); `mapping.tsv` lo crea vacio. El proxy
 *         resuelve su propio `__dirname` via `import.meta.url`, que apunta
 *         al path real en userData y le deja leer `mapping.tsv` al lado.
 *
 * Ver `proxy-bootstrap.ts` para la justificacion de mover mapping a userData
 * y los detalles del bootstrap.
 */
async function resolveAppRoot(): Promise<string> {
  if (app.isPackaged) {
    return ensureUserDataProxy();
  }
  return resolve(app.getAppPath(), '..');
}

function pipeChildStream(stream: NodeJS.ReadableStream | null, source: 'stdout' | 'stderr'): void {
  if (!stream) {
    logger.warn(`pipeChildStream(${source}): stream es null`);
    return;
  }
  logger.info(`pipeChildStream(${source}): pipe abierto, esperando datos`);
  const rl = createInterface({ input: stream });
  rl.on('line', (line) => {
    logger.info(`pipeChildStream(${source}) raw: ${line.substring(0, 500)}`);
    appendLogLine(line);
  });
  rl.on('close', () => logger.info(`pipeChildStream(${source}): cerrado`));
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

  const appRoot = await resolveAppRoot();
  const entry = join(appRoot, 'index.js');
  if (!existsSync(entry)) {
    const reason = `index.js no encontrado en ${appRoot}`;
    logger.error(`startProxy: ${reason}`);
    return { ok: false, reason };
  }

  emitProxyState({ state: 'starting' });

  try {
    const spawned = utilityProcess.fork(join(appRoot, 'index.js'), [], {
      cwd: appRoot,
      stdio: 'pipe',
      serviceName: 'proxy-mapper',
    });
    child = spawned;

    const pid = spawned.pid ?? -1;
    logger.info(`startProxy: proxy arrancado (pid=${pid}) en ${appRoot} via utilityProcess`);

    // US-056: pipear stdout/stderr al buffer + IPC.
    pipeChildStream(spawned.stdout, 'stdout');
    pipeChildStream(spawned.stderr, 'stderr');

    // US-055: listeners para detectar crash / exit normal.
    // Nota: UtilityProcess TS types sólo declaran 'exit'/'message'/'spawn',
    // pero a runtime también emite 'error' (EventEmitter). Cast a EventEmitter
    // para subscribir sin romper el typecheck.
    const emitter = spawned as unknown as NodeJS.EventEmitter;
    emitter.on('error', (err: Error) => {
      logger.error(`startProxy: child error: ${err.message}`);
      if (child === spawned) child = null;
      emitCrashed(err.message);
    });

    spawned.on('exit', (code: number) => {
      logger.info(`startProxy: child exited (code=${code ?? 'null'})`);
      if (child === spawned) child = null;
      if (stopInProgress || code === 0 || code === null) {
        emitProxyState({ state: 'off' });
      } else {
        emitCrashed(`Exit code ${code}`);
      }
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
    // UtilityProcess no expone exitCode/signalCode en sus types; usamos el
    // return value de kill() (true = signal enviado, false = ya terminado).
    let killSent = false;
    try {
      killSent = target.kill();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`stopProxy: fallo al enviar kill: ${reason}`);
      return { ok: false, reason };
    }

    if (!killSent) {
      logger.info(`stopProxy: process ya terminado antes del kill`);
      return { ok: true };
    }

    logger.info(`stopProxy: kill signal enviado a pid=${target.pid ?? '?'}`);

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

      forceKillTimer = setTimeout(() => {
        const pid = target.pid;
        if (pid === undefined) {
          finish({ ok: false, reason: 'force_kill_no_pid' });
          return;
        }
        logger.warn(
          `stopProxy: no terminó en ${FORCE_KILL_TIMEOUT_MS}ms, escalando a taskkill /f (pid=${pid})`,
        );
        const tk = nativeSpawn(
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
