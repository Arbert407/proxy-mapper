"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_readline = require("node:readline");
const promises = require("node:fs/promises");
const PROXY_SPAWN_OPTIONS = {
  windowsHide: true
};
const LEVEL_PATTERNS = [
  { regex: /!!!\s*LEAK\s+DETECTED\s*!!!/i, level: "leak" },
  { regex: /\[ERROR\]/i, level: "error" },
  { regex: /\[WARN\]/i, level: "warn" },
  { regex: /\[(\d+)\/\d+\]/, level: "done" }
];
function parseLogLevel(line) {
  for (const { regex, level } of LEVEL_PATTERNS) {
    if (regex.test(line)) return level;
  }
  return "info";
}
const MAX_SIZE = 5 * 1024 * 1024;
let currentSize = 0;
let logPath = null;
let chain = Promise.resolve();
async function ensurePath() {
  if (logPath) return logPath;
  const logsDir = node_path.join(electron.app.getPath("userData"), "logs");
  await promises.mkdir(logsDir, { recursive: true });
  logPath = node_path.join(logsDir, "app.log");
  const stats = await promises.stat(logPath).catch(() => null);
  currentSize = (stats == null ? void 0 : stats.size) ?? 0;
  return logPath;
}
async function rotateIfNeeded() {
  if (currentSize < MAX_SIZE || !logPath) return;
  const rotatedPath = `${logPath}.1`;
  await promises.rename(logPath, rotatedPath).catch(() => {
  });
  logPath = null;
  await ensurePath();
}
async function writeLine(level, message) {
  await rotateIfNeeded();
  const path = await ensurePath();
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const line = `${ts} [${level}] ${message}
`;
  await promises.appendFile(path, line, "utf8");
  currentSize += Buffer.byteLength(line, "utf8");
}
function enqueue(level, message) {
  chain = chain.then(() => writeLine(level, message)).catch(() => {
  });
}
const logger = {
  debug: (msg) => enqueue("DEBUG", msg),
  info: (msg) => enqueue("INFO", msg),
  warn: (msg) => enqueue("WARN", msg),
  error: (msg) => enqueue("ERROR", msg),
  flush: () => chain
};
let target = null;
function bindMainWindow() {
  const win = electron.BrowserWindow.getAllWindows()[0];
  if (win) {
    target = win.webContents;
    logger.info(`bindMainWindow: target seteado (win id=${win.id})`);
  } else {
    logger.warn(`bindMainWindow: no hay ventanas todavía`);
  }
}
function send(channel, payload) {
  if (!target || target.isDestroyed()) {
    target = null;
    logger.warn(`send(${channel}): target es null o destruido`);
    return;
  }
  target.send(channel, payload);
}
function emitProxyState(change) {
  send("proxy:state", change);
}
function emitLogAppend(entry) {
  logger.info(`emitLogAppend: enviando logs:append (msg=${entry.message.substring(0, 60)})`);
  send("logs:append", entry);
}
function appendLogLine(rawLine) {
  const message = rawLine.replace(/\r$/, "").replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]\s*/, "");
  if (message.length === 0) return;
  const entry = {
    level: parseLogLevel(message),
    message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  emitLogAppend(entry);
}
const FORCE_KILL_TIMEOUT_MS = 5e3;
let child = null;
let stopInProgress = false;
function resolveAppRoot() {
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "proxy");
  }
  return node_path.resolve(electron.app.getAppPath(), "..");
}
function pipeChildStream(stream, source) {
  if (!stream) {
    logger.warn(`pipeChildStream(${source}): stream es null`);
    return;
  }
  logger.info(`pipeChildStream(${source}): pipe abierto, esperando datos`);
  const rl = node_readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    logger.info(`pipeChildStream(${source}) raw: ${line.substring(0, 500)}`);
    appendLogLine(line);
  });
  rl.on("close", () => logger.info(`pipeChildStream(${source}): cerrado`));
}
function emitCrashed(reason) {
  logger.error(`proxy: crashed — ${reason}`);
  emitProxyState({ state: "crashed", reason });
}
async function startProxy() {
  if (child !== null || stopInProgress) {
    return { ok: false, reason: "already_running" };
  }
  const appRoot = resolveAppRoot();
  const entry = node_path.join(appRoot, "index.js");
  if (!node_fs.existsSync(entry)) {
    const reason = `index.js no encontrado en ${appRoot}`;
    logger.error(`startProxy: ${reason}`);
    return { ok: false, reason };
  }
  emitProxyState({ state: "starting" });
  try {
    const spawned = electron.utilityProcess.fork(node_path.join(appRoot, "index.js"), [], {
      cwd: appRoot,
      stdio: "pipe",
      serviceName: "proxy-mapper"
    });
    child = spawned;
    const pid = spawned.pid ?? -1;
    logger.info(`startProxy: proxy arrancado (pid=${pid}) en ${appRoot} via utilityProcess`);
    pipeChildStream(spawned.stdout, "stdout");
    pipeChildStream(spawned.stderr, "stderr");
    const emitter = spawned;
    emitter.on("error", (err) => {
      logger.error(`startProxy: child error: ${err.message}`);
      if (child === spawned) child = null;
      emitCrashed(err.message);
    });
    spawned.on("exit", (code) => {
      logger.info(`startProxy: child exited (code=${code ?? "null"})`);
      if (child === spawned) child = null;
      if (stopInProgress || code === 0 || code === null) {
        emitProxyState({ state: "off" });
      } else {
        emitCrashed(`Exit code ${code}`);
      }
    });
    emitProxyState({ state: "running" });
    return { ok: true, pid };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`startProxy: fallo al spawnar: ${reason}`);
    emitProxyState({ state: "off", reason });
    return { ok: false, reason };
  }
}
async function stopProxy() {
  if (child === null) {
    return { ok: false, reason: "not_running" };
  }
  if (stopInProgress) {
    return { ok: false, reason: "stop_in_progress" };
  }
  stopInProgress = true;
  const target2 = child;
  emitProxyState({ state: "stopping" });
  try {
    let killSent = false;
    try {
      killSent = target2.kill();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`stopProxy: fallo al enviar kill: ${reason}`);
      return { ok: false, reason };
    }
    if (!killSent) {
      logger.info(`stopProxy: process ya terminado antes del kill`);
      return { ok: true };
    }
    logger.info(`stopProxy: kill signal enviado a pid=${target2.pid ?? "?"}`);
    return await new Promise((resolve2) => {
      let resolved = false;
      let forceKillTimer;
      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        if (forceKillTimer !== void 0) clearTimeout(forceKillTimer);
        resolve2(result);
      };
      target2.once("exit", () => {
        logger.info(`stopProxy: proxy terminado (pid=${target2.pid ?? "?"})`);
        finish({ ok: true });
      });
      forceKillTimer = setTimeout(() => {
        const pid = target2.pid;
        if (pid === void 0) {
          finish({ ok: false, reason: "force_kill_no_pid" });
          return;
        }
        logger.warn(
          `stopProxy: no terminó en ${FORCE_KILL_TIMEOUT_MS}ms, escalando a taskkill /f (pid=${pid})`
        );
        const tk = node_child_process.spawn(
          "taskkill",
          ["/pid", String(pid), "/t", "/f"],
          PROXY_SPAWN_OPTIONS
        );
        tk.once("exit", (code) => {
          if (code !== 0) {
            logger.error(`stopProxy: taskkill /f salió con código ${code}`);
          }
        });
        tk.once("error", (err) => {
          logger.error(`stopProxy: taskkill /f error: ${err.message}`);
        });
      }, FORCE_KILL_TIMEOUT_MS);
    });
  } finally {
    stopInProgress = false;
  }
}
function assertTrustedSender(event) {
  const win = electron.BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("IPC sender no autorizado (sin BrowserWindow padre)");
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("proxy:start", (event) => {
    assertTrustedSender(event);
    return startProxy();
  });
  electron.ipcMain.handle("proxy:stop", (event) => {
    assertTrustedSender(event);
    return stopProxy();
  });
}
const FALLBACK_VERSION = "0.0.0";
const readPackageVersion = (pkgPath) => {
  try {
    const raw = node_fs.readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "version" in parsed) {
      const v = parsed.version;
      if (typeof v === "string" && v.length > 0) return v;
    }
    return FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
};
const readVersions = (mainDir) => ({
  wrapper: readPackageVersion(node_path.join(mainDir, "../package.json")),
  proxy: readPackageVersion(node_path.join(mainDir, "../../package.json"))
});
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1024,
    height: 700,
    title: "Proxy Mapper",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: node_path.join(__dirname, "../preload/index.js")
    }
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electron.ipcMain.handle("app:version", () => readVersions(__dirname));
  registerIpcHandlers();
  createWindow();
  bindMainWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
