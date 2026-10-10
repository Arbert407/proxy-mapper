"use strict";
const electron = require("electron");
const api = {
  proxy: {
    start: () => electron.ipcRenderer.invoke("proxy:start"),
    stop: () => electron.ipcRenderer.invoke("proxy:stop"),
    onStateChange: (cb) => {
      const listener = (_e, change) => cb(change);
      electron.ipcRenderer.on("proxy:state", listener);
      return () => {
        electron.ipcRenderer.removeListener("proxy:state", listener);
      };
    }
  },
  logs: {
    onAppend: (cb) => {
      const listener = (_e, entry) => cb(entry);
      electron.ipcRenderer.on("logs:append", listener);
      return () => {
        electron.ipcRenderer.removeListener("logs:append", listener);
      };
    },
    read: () => electron.ipcRenderer.invoke("logs:read"),
    clear: () => electron.ipcRenderer.invoke("logs:clear"),
    save: () => electron.ipcRenderer.invoke("logs:save")
  },
  mappings: {
    read: () => electron.ipcRenderer.invoke("mappings:read"),
    write: (pairs) => electron.ipcRenderer.invoke("mappings:write", pairs),
    export: (pairs) => electron.ipcRenderer.invoke("mappings:export", pairs),
    import: () => electron.ipcRenderer.invoke("mappings:import")
  },
  app: {
    getVersion: () => electron.ipcRenderer.invoke("app:version")
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
