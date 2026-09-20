"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_child_process = require("node:child_process");
const require$$0$2 = require("child_process");
const require$$0$1 = require("path");
const require$$0 = require("fs");
const node_fs = require("node:fs");
const node_readline = require("node:readline");
const promises = require("node:fs/promises");
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var crossSpawn$1 = { exports: {} };
var windows;
var hasRequiredWindows;
function requireWindows() {
  if (hasRequiredWindows) return windows;
  hasRequiredWindows = 1;
  windows = isexe2;
  isexe2.sync = sync2;
  var fs2 = require$$0;
  function checkPathExt(path2, options) {
    var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
    if (!pathext) {
      return true;
    }
    pathext = pathext.split(";");
    if (pathext.indexOf("") !== -1) {
      return true;
    }
    for (var i = 0; i < pathext.length; i++) {
      var p = pathext[i].toLowerCase();
      if (p && path2.substr(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }
  function checkStat(stat, path2, options) {
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      return false;
    }
    return checkPathExt(path2, options);
  }
  function isexe2(path2, options, cb) {
    fs2.stat(path2, function(er, stat) {
      cb(er, er ? false : checkStat(stat, path2, options));
    });
  }
  function sync2(path2, options) {
    return checkStat(fs2.statSync(path2), path2, options);
  }
  return windows;
}
var mode;
var hasRequiredMode;
function requireMode() {
  if (hasRequiredMode) return mode;
  hasRequiredMode = 1;
  mode = isexe2;
  isexe2.sync = sync2;
  var fs2 = require$$0;
  function isexe2(path2, options, cb) {
    fs2.stat(path2, function(er, stat) {
      cb(er, er ? false : checkStat(stat, options));
    });
  }
  function sync2(path2, options) {
    return checkStat(fs2.statSync(path2), options);
  }
  function checkStat(stat, options) {
    return stat.isFile() && checkMode(stat, options);
  }
  function checkMode(stat, options) {
    var mod = stat.mode;
    var uid = stat.uid;
    var gid = stat.gid;
    var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
    var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
    var u = parseInt("100", 8);
    var g = parseInt("010", 8);
    var o = parseInt("001", 8);
    var ug = u | g;
    var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
    return ret;
  }
  return mode;
}
var core;
if (process.platform === "win32" || commonjsGlobal.TESTING_WINDOWS) {
  core = requireWindows();
} else {
  core = requireMode();
}
var isexe_1 = isexe$1;
isexe$1.sync = sync;
function isexe$1(path2, options, cb) {
  if (typeof options === "function") {
    cb = options;
    options = {};
  }
  if (!cb) {
    if (typeof Promise !== "function") {
      throw new TypeError("callback not provided");
    }
    return new Promise(function(resolve, reject) {
      isexe$1(path2, options || {}, function(er, is) {
        if (er) {
          reject(er);
        } else {
          resolve(is);
        }
      });
    });
  }
  core(path2, options || {}, function(er, is) {
    if (er) {
      if (er.code === "EACCES" || options && options.ignoreErrors) {
        er = null;
        is = false;
      }
    }
    cb(er, is);
  });
}
function sync(path2, options) {
  try {
    return core.sync(path2, options || {});
  } catch (er) {
    if (options && options.ignoreErrors || er.code === "EACCES") {
      return false;
    } else {
      throw er;
    }
  }
}
const isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
const path$2 = require$$0$1;
const COLON = isWindows ? ";" : ":";
const isexe = isexe_1;
const getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
const getPathInfo = (cmd, opt) => {
  const colon = opt.colon || COLON;
  const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
    // windows always checks the cwd first
    ...isWindows ? [process.cwd()] : [],
    ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
    "").split(colon)
  ];
  const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
  const pathExt = isWindows ? pathExtExe.split(colon) : [""];
  if (isWindows) {
    if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
      pathExt.unshift("");
  }
  return {
    pathEnv,
    pathExt,
    pathExtExe
  };
};
const which$1 = (cmd, opt, cb) => {
  if (typeof opt === "function") {
    cb = opt;
    opt = {};
  }
  if (!opt)
    opt = {};
  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];
  const step = (i) => new Promise((resolve, reject) => {
    if (i === pathEnv.length)
      return opt.all && found.length ? resolve(found) : reject(getNotFoundError(cmd));
    const ppRaw = pathEnv[i];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
    const pCmd = path$2.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
    resolve(subStep(p, i, 0));
  });
  const subStep = (p, i, ii) => new Promise((resolve, reject) => {
    if (ii === pathExt.length)
      return resolve(step(i + 1));
    const ext = pathExt[ii];
    isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
      if (!er && is) {
        if (opt.all)
          found.push(p + ext);
        else
          return resolve(p + ext);
      }
      return resolve(subStep(p, i, ii + 1));
    });
  });
  return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
};
const whichSync = (cmd, opt) => {
  opt = opt || {};
  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];
  for (let i = 0; i < pathEnv.length; i++) {
    const ppRaw = pathEnv[i];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
    const pCmd = path$2.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
    for (let j = 0; j < pathExt.length; j++) {
      const cur = p + pathExt[j];
      try {
        const is = isexe.sync(cur, { pathExt: pathExtExe });
        if (is) {
          if (opt.all)
            found.push(cur);
          else
            return cur;
        }
      } catch (ex) {
      }
    }
  }
  if (opt.all && found.length)
    return found;
  if (opt.nothrow)
    return null;
  throw getNotFoundError(cmd);
};
var which_1 = which$1;
which$1.sync = whichSync;
var pathKey$1 = { exports: {} };
const pathKey = (options = {}) => {
  const environment = options.env || process.env;
  const platform = options.platform || process.platform;
  if (platform !== "win32") {
    return "PATH";
  }
  return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
};
pathKey$1.exports = pathKey;
pathKey$1.exports.default = pathKey;
var pathKeyExports = pathKey$1.exports;
const path$1 = require$$0$1;
const which = which_1;
const getPathKey = pathKeyExports;
function resolveCommandAttempt(parsed, withoutPathExt) {
  const env = parsed.options.env || process.env;
  const cwd = process.cwd();
  const hasCustomCwd = parsed.options.cwd != null;
  const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
  if (shouldSwitchCwd) {
    try {
      process.chdir(parsed.options.cwd);
    } catch (err) {
    }
  }
  let resolved;
  try {
    resolved = which.sync(parsed.command, {
      path: env[getPathKey({ env })],
      pathExt: withoutPathExt ? path$1.delimiter : void 0
    });
  } catch (e) {
  } finally {
    if (shouldSwitchCwd) {
      process.chdir(cwd);
    }
  }
  if (resolved) {
    resolved = path$1.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
  }
  return resolved;
}
function resolveCommand$1(parsed) {
  return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
}
var resolveCommand_1 = resolveCommand$1;
var _escape = {};
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
function escapeCommand(arg) {
  arg = arg.replace(metaCharsRegExp, "^$1");
  return arg;
}
function escapeArgument(arg, doubleEscapeMetaChars) {
  arg = `${arg}`;
  arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
  arg = `"${arg}"`;
  arg = arg.replace(metaCharsRegExp, "^$1");
  if (doubleEscapeMetaChars) {
    arg = arg.replace(metaCharsRegExp, "^$1");
  }
  return arg;
}
_escape.command = escapeCommand;
_escape.argument = escapeArgument;
var shebangRegex$1 = /^#!(.*)/;
const shebangRegex = shebangRegex$1;
var shebangCommand$1 = (string = "") => {
  const match = string.match(shebangRegex);
  if (!match) {
    return null;
  }
  const [path2, argument] = match[0].replace(/#! ?/, "").split(" ");
  const binary = path2.split("/").pop();
  if (binary === "env") {
    return argument;
  }
  return argument ? `${binary} ${argument}` : binary;
};
const fs = require$$0;
const shebangCommand = shebangCommand$1;
function readShebang$1(command) {
  const size = 150;
  const buffer = Buffer.alloc(size);
  let fd;
  try {
    fd = fs.openSync(command, "r");
    fs.readSync(fd, buffer, 0, size, 0);
    fs.closeSync(fd);
  } catch (e) {
  }
  return shebangCommand(buffer.toString());
}
var readShebang_1 = readShebang$1;
const path = require$$0$1;
const resolveCommand = resolveCommand_1;
const escape = _escape;
const readShebang = readShebang_1;
const isWin$1 = process.platform === "win32";
const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
function detectShebang(parsed) {
  parsed.file = resolveCommand(parsed);
  const shebang = parsed.file && readShebang(parsed.file);
  if (shebang) {
    parsed.args.unshift(parsed.file);
    parsed.command = shebang;
    return resolveCommand(parsed);
  }
  return parsed.file;
}
function parseNonShell(parsed) {
  if (!isWin$1) {
    return parsed;
  }
  const commandFile = detectShebang(parsed);
  const needsShell = !isExecutableRegExp.test(commandFile);
  if (parsed.options.forceShell || needsShell) {
    const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
    parsed.command = path.normalize(parsed.command);
    parsed.command = escape.command(parsed.command);
    parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
    const shellCommand = [parsed.command].concat(parsed.args).join(" ");
    parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
    parsed.command = process.env.comspec || "cmd.exe";
    parsed.options.windowsVerbatimArguments = true;
  }
  return parsed;
}
function parse$1(command, args, options) {
  if (args && !Array.isArray(args)) {
    options = args;
    args = null;
  }
  args = args ? args.slice(0) : [];
  options = Object.assign({}, options);
  const parsed = {
    command,
    args,
    options,
    file: void 0,
    original: {
      command,
      args
    }
  };
  return options.shell ? parsed : parseNonShell(parsed);
}
var parse_1 = parse$1;
const isWin = process.platform === "win32";
function notFoundError(original, syscall) {
  return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
    code: "ENOENT",
    errno: "ENOENT",
    syscall: `${syscall} ${original.command}`,
    path: original.command,
    spawnargs: original.args
  });
}
function hookChildProcess(cp2, parsed) {
  if (!isWin) {
    return;
  }
  const originalEmit = cp2.emit;
  cp2.emit = function(name, arg1) {
    if (name === "exit") {
      const err = verifyENOENT(arg1, parsed);
      if (err) {
        return originalEmit.call(cp2, "error", err);
      }
    }
    return originalEmit.apply(cp2, arguments);
  };
}
function verifyENOENT(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawn");
  }
  return null;
}
function verifyENOENTSync(status, parsed) {
  if (isWin && status === 1 && !parsed.file) {
    return notFoundError(parsed.original, "spawnSync");
  }
  return null;
}
var enoent$1 = {
  hookChildProcess,
  verifyENOENT,
  verifyENOENTSync,
  notFoundError
};
const cp = require$$0$2;
const parse = parse_1;
const enoent = enoent$1;
function spawn(command, args, options) {
  const parsed = parse(command, args, options);
  const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
  enoent.hookChildProcess(spawned, parsed);
  return spawned;
}
function spawnSync(command, args, options) {
  const parsed = parse(command, args, options);
  const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
  result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
  return result;
}
crossSpawn$1.exports = spawn;
crossSpawn$1.exports.spawn = spawn;
crossSpawn$1.exports.sync = spawnSync;
crossSpawn$1.exports._parse = parse;
crossSpawn$1.exports._enoent = enoent;
var crossSpawnExports = crossSpawn$1.exports;
const crossSpawn = /* @__PURE__ */ getDefaultExportFromCjs(crossSpawnExports);
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
  const path2 = await ensurePath();
  const ts = (/* @__PURE__ */ new Date()).toISOString();
  const line = `${ts} [${level}] ${message}
`;
  await promises.appendFile(path2, line, "utf8");
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
function safeSpawn(command, args, options) {
  return crossSpawn(command, args, options);
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
    logger.info(`pipeChildStream(${source}) raw: ${line.substring(0, 80)}`);
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
    const spawned = safeSpawn("node", ["index.js"], {
      cwd: appRoot,
      ...PROXY_SPAWN_OPTIONS
    });
    child = spawned;
    const pid = spawned.pid ?? -1;
    logger.info(`startProxy: proxy arrancado (pid=${pid}) en ${appRoot}`);
    pipeChildStream(spawned.stdout, "stdout");
    pipeChildStream(spawned.stderr, "stderr");
    spawned.on("exit", (code, signal) => {
      logger.info(
        `startProxy: child exited (code=${code ?? "null"}, signal=${signal ?? "null"})`
      );
      if (child === spawned) child = null;
      if (stopInProgress || code === 0 || code === null) {
        emitProxyState({ state: "off" });
      } else {
        const reasonStr = `Exit code ${code}${signal ? ` (signal ${signal})` : ""}`;
        emitCrashed(reasonStr);
      }
    });
    spawned.on("error", (err) => {
      if (child === spawned) child = null;
      emitCrashed(err.message);
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
    if (target2.exitCode !== null || target2.signalCode !== null) {
      logger.info(
        `stopProxy: child ya terminado (exit=${target2.exitCode}, signal=${target2.signalCode})`
      );
      return { ok: true };
    }
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
      try {
        target2.kill();
        logger.info(`stopProxy: kill signal enviado a pid=${target2.pid ?? "?"}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.error(`stopProxy: fallo al enviar kill: ${reason}`);
        finish({ ok: false, reason });
        return;
      }
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
