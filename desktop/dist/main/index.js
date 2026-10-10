"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_readline = require("node:readline");
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
const MAX_BUFFER = 5e3;
const buffer = [];
function getLogsBuffer() {
  return buffer.slice();
}
function clearLogsBuffer() {
  buffer.length = 0;
}
function appendLogLine(rawLine) {
  const message = rawLine.replace(/\r$/, "").replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]\s*/, "");
  if (message.length === 0) return;
  const entry = {
    level: parseLogLevel(message),
    message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  buffer.push(entry);
  while (buffer.length > MAX_BUFFER) buffer.shift();
  emitLogAppend(entry);
}
function getUserDataProxyDir() {
  return node_path.join(electron.app.getPath("userData"), "proxy");
}
function getBundleProxyDir() {
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "proxy");
  }
  return node_path.join(electron.app.getAppPath(), "..", "proxy");
}
async function fileExists(path) {
  try {
    await promises.access(path);
    return true;
  } catch {
    return false;
  }
}
async function ensureUserDataProxy() {
  const userDir = getUserDataProxyDir();
  try {
    await promises.mkdir(userDir, { recursive: true });
    logger.info(`bootstrap: directorio de proxy en userData = ${userDir}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`bootstrap: no se pudo crear ${userDir}: ${reason}`);
    throw err;
  }
  const bundleDir = getBundleProxyDir();
  const filesToSync = [
    { name: "index.js", mandatory: true },
    { name: "package.json", mandatory: true }
  ];
  for (const { name, mandatory } of filesToSync) {
    const src = node_path.join(bundleDir, name);
    const dst = node_path.join(userDir, name);
    try {
      await promises.copyFile(src, dst);
      logger.debug(`bootstrap: copiado ${src} -> ${dst}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (mandatory) {
        logger.error(`bootstrap: fallo al copiar ${name}: ${reason}`);
        throw err;
      }
      logger.warn(`bootstrap: ${name} no se pudo copiar (${reason})`);
    }
  }
  const mappingPath = node_path.join(userDir, "mapping.tsv");
  if (!await fileExists(mappingPath)) {
    const bundleMapping = node_path.join(bundleDir, "mapping.tsv");
    try {
      if (await fileExists(bundleMapping)) {
        await promises.copyFile(bundleMapping, mappingPath);
        logger.info(`bootstrap: mapping.tsv copiado desde bundle a ${mappingPath}`);
      } else {
        await promises.writeFile(mappingPath, "", "utf-8");
        logger.info(`bootstrap: mapping.tsv vacio creado en ${mappingPath}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`bootstrap: no se pudo crear mapping.tsv: ${reason}`);
      throw err;
    }
  } else {
    logger.debug(`bootstrap: mapping.tsv ya existe en ${mappingPath} (no se sobreescribe)`);
  }
  return userDir;
}
const FORCE_KILL_TIMEOUT_MS = 5e3;
let child = null;
let stopInProgress = false;
function isProxyRunning() {
  return child !== null;
}
async function resolveAppRoot() {
  if (electron.app.isPackaged) {
    return ensureUserDataProxy();
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
  const appRoot = await resolveAppRoot();
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
function validateMappings(pairs) {
  const errors = {};
  const realIndices = /* @__PURE__ */ new Map();
  for (let i = 0; i < pairs.length; i++) {
    const { real, masked } = pairs[i];
    const err = {};
    if (real.trim().length === 0) {
      err.real = "Real no puede estar vacío";
    } else if (/[\t\n\r]/.test(real)) {
      err.real = "Real no puede contener tab ni salto de línea";
    }
    if (masked.trim().length === 0) {
      err.masked = "Masked no puede estar vacío";
    } else if (/[\t\n\r]/.test(masked)) {
      err.masked = "Masked no puede contener tab ni salto de línea";
    }
    if (Object.keys(err).length > 0) {
      errors[i] = err;
    }
    if (real.trim().length > 0) {
      const list = realIndices.get(real) ?? [];
      list.push(i);
      realIndices.set(real, list);
    }
  }
  for (const [value, indices] of realIndices.entries()) {
    if (indices.length < 2) continue;
    for (const idx of indices) {
      const others = indices.filter((j) => j !== idx).map((j) => j + 1);
      const err = errors[idx] ?? {};
      err.real = `Real duplicado (también fila${others.length > 1 ? "s" : ""} ${others.join(", ")}): "${value}"`;
      err.duplicate = true;
      errors[idx] = err;
    }
  }
  return errors;
}
const EXPORT_FILENAME = "export_mappings_proxy_mapper.tsv";
function resolveMappingPath() {
  if (electron.app.isPackaged) {
    return node_path.join(getUserDataProxyDir(), "mapping.tsv");
  }
  return node_path.join(electron.app.getAppPath(), "..", "mapping.tsv");
}
function parseTsv(content) {
  const pairs = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, "");
    if (!line) continue;
    const tabIdx = line.indexOf("	");
    if (tabIdx === -1) continue;
    const real = line.substring(0, tabIdx);
    const masked = line.substring(tabIdx + 1);
    if (!real || !masked) continue;
    pairs.push({ real, masked });
  }
  return pairs;
}
function serializeTsv(pairs) {
  return pairs.map((p) => `${p.real}	${p.masked}`).join("\n") + "\n";
}
async function readMappings() {
  const path = resolveMappingPath();
  try {
    const content = await promises.readFile(path, "utf-8");
    const pairs = parseTsv(content);
    logger.info(`mappings.read: ${pairs.length} pares leídos desde ${path}`);
    return { ok: true, pairs, path };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      logger.info(`mappings.read: archivo no existe en ${path}, retornando []`);
      return { ok: true, pairs: [], path };
    }
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.read: error al leer ${path}: ${reason}`);
    return { ok: false, reason };
  }
}
async function writeMappings(pairs) {
  const path = resolveMappingPath();
  const errors = validateMappings(pairs);
  for (const err of Object.values(errors)) {
    if (err.real || err.masked) {
      if (!err.duplicate) {
        logger.warn(`mappings.write: rechazo por validación: ${err.real ?? err.masked}`);
        return { ok: false, reason: "invalid_pairs" };
      }
    }
  }
  try {
    await promises.writeFile(path, serializeTsv(pairs), "utf-8");
    logger.info(`mappings.write: ${pairs.length} pares escritos en ${path}`);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.write: error al escribir ${path}: ${reason}`);
    return { ok: false, reason };
  }
}
async function exportMappingsToFile(win, pairs) {
  const dlg = await electron.dialog.showSaveDialog(win, {
    title: "Exportar mappings",
    defaultPath: EXPORT_FILENAME,
    filters: [
      { name: "TSV (mappings)", extensions: ["tsv"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });
  if (dlg.canceled || !dlg.filePath) {
    logger.info("mappings.export: cancelado por el usuario");
    return { ok: false, reason: "canceled" };
  }
  try {
    await promises.writeFile(dlg.filePath, serializeTsv(pairs), "utf-8");
    logger.info(`mappings.export: ${pairs.length} pares escritos en ${dlg.filePath}`);
    return { ok: true, path: dlg.filePath };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.export: error al escribir ${dlg.filePath}: ${reason}`);
    return { ok: false, reason };
  }
}
async function importMappingsFromFile(win) {
  const dlg = await electron.dialog.showOpenDialog(win, {
    title: "Importar mappings",
    properties: ["openFile"],
    filters: [
      { name: "TSV (mappings)", extensions: ["tsv"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });
  if (dlg.canceled || dlg.filePaths.length === 0) {
    logger.info("mappings.import: cancelado por el usuario");
    return { ok: false, reason: "canceled" };
  }
  const filePath = dlg.filePaths[0];
  let content;
  try {
    content = await promises.readFile(filePath, "utf-8");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.import: error al leer ${filePath}: ${reason}`);
    return { ok: false, reason };
  }
  const allParsed = parseTsv(content);
  const errors = validateMappings(allParsed);
  const valid = [];
  for (let i = 0; i < allParsed.length; i++) {
    const err = errors[i];
    if (!(err == null ? void 0 : err.real) && !(err == null ? void 0 : err.masked)) {
      valid.push(allParsed[i]);
    }
  }
  const skipped = allParsed.length - valid.length;
  logger.info(
    `mappings.import: ${valid.length} válidos, ${skipped} omitidos desde ${filePath}`
  );
  if (allParsed.length > 0 && valid.length === 0) {
    return { ok: false, reason: "no_valid_pairs", path: filePath };
  }
  return { ok: true, pairs: valid, skipped, path: filePath };
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
  electron.ipcMain.handle("logs:read", (event) => {
    assertTrustedSender(event);
    return getLogsBuffer();
  });
  electron.ipcMain.handle("logs:clear", (event) => {
    assertTrustedSender(event);
    logger.info("logs:clear: vaciando buffer FIFO en main");
    clearLogsBuffer();
    return { ok: true };
  });
  electron.ipcMain.handle("logs:save", async (event) => {
    assertTrustedSender(event);
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error("logs:save: sin BrowserWindow padre para el diálogo");
      return { ok: false, reason: "no_window" };
    }
    const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const defaultName = `proxy-mapper-logs-${ts}.txt`;
    const dlg = await electron.dialog.showSaveDialog(win, {
      title: "Guardar logs del proxy",
      defaultPath: defaultName,
      filters: [
        { name: "Texto", extensions: ["txt"] },
        { name: "Todos los archivos", extensions: ["*"] }
      ]
    });
    if (dlg.canceled || !dlg.filePath) {
      logger.info("logs:save: cancelado por el usuario");
      return { ok: false, reason: "canceled" };
    }
    try {
      const buffer2 = getLogsBuffer();
      const content = buffer2.map((e) => `${e.timestamp} ${e.message}`).join("\n");
      await promises.writeFile(dlg.filePath, content, "utf8");
      logger.info(`logs:save: ${buffer2.length} líneas escritas en ${dlg.filePath}`);
      return { ok: true, path: dlg.filePath };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.error(`logs:save: error al escribir ${dlg.filePath}: ${reason}`);
      return { ok: false, reason };
    }
  });
  electron.ipcMain.handle("mappings:read", async (event) => {
    assertTrustedSender(event);
    return readMappings();
  });
  electron.ipcMain.handle("mappings:write", async (event, pairs) => {
    assertTrustedSender(event);
    return writeMappings(pairs);
  });
  electron.ipcMain.handle("mappings:export", async (event, pairs) => {
    assertTrustedSender(event);
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error("mappings:export: sin BrowserWindow padre para el diálogo");
      return { ok: false, reason: "no_window" };
    }
    return exportMappingsToFile(win, pairs);
  });
  electron.ipcMain.handle("mappings:import", async (event) => {
    assertTrustedSender(event);
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      logger.error("mappings:import: sin BrowserWindow padre para el diálogo");
      return { ok: false, reason: "no_window" };
    }
    return importMappingsFromFile(win);
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
const readVersions = (mainDir) => {
  const wrapperPath = node_path.join(mainDir, "../package.json");
  const proxyPath = electron.app.isPackaged ? node_path.join(getUserDataProxyDir(), "package.json") : node_path.join(mainDir, "../../package.json");
  return {
    wrapper: readPackageVersion(wrapperPath),
    proxy: readPackageVersion(proxyPath)
  };
};
electron.app.setAppUserModelId("com.anomaly.proxy-mapper-desktop");
electron.Menu.setApplicationMenu(null);
let isQuitting = false;
electron.app.on("before-quit", (event) => {
  if (!isProxyRunning() || isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  logger.info("before-quit: proxy vivo, deteniendo antes de salir");
  void stopProxy().then((result) => {
    if (!result.ok) {
      logger.error(`before-quit: stopProxy falló (${result.reason}), saliendo igual`);
    }
  }).finally(() => {
    electron.app.quit();
  });
});
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1024,
    height: 700,
    title: "Proxy Mapper",
    autoHideMenuBar: true,
    // US-073: icono de la ventana (en dev, el .exe aún no existe; en prod
    // el del .exe toma precedencia pero este sirve para el splash inicial).
    icon: node_path.join(__dirname, "../../resources/icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: node_path.join(__dirname, "../preload/index.js")
    }
  });
  if (process.env["VITE_DEV_SERVER_URL"]) {
    win.loadURL(process.env["VITE_DEV_SERVER_URL"]);
  } else {
    win.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electron.ipcMain.handle("app:version", () => readVersions(__dirname));
  registerIpcHandlers();
  createWindow();
  bindMainWindow();
  void ensureUserDataProxy().catch((err) => {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`whenReady: bootstrap del proxy fallo: ${reason}`);
  });
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
