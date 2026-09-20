import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Api, LogEntry, MappingPair, ProxyStateChange } from '../shared/types';

const api: Api = {
  proxy: {
    start: () => ipcRenderer.invoke('proxy:start'),
    stop: () => ipcRenderer.invoke('proxy:stop'),
    onStateChange: (cb: (change: ProxyStateChange) => void) => {
      const listener = (_e: IpcRendererEvent, change: ProxyStateChange) => cb(change);
      ipcRenderer.on('proxy:state', listener);
      return () => {
        ipcRenderer.removeListener('proxy:state', listener);
      };
    },
  },
  logs: {
    onAppend: (cb: (entry: LogEntry) => void) => {
      const listener = (_e: IpcRendererEvent, entry: LogEntry) => cb(entry);
      ipcRenderer.on('logs:append', listener);
      return () => {
        ipcRenderer.removeListener('logs:append', listener);
      };
    },
    clear: () => ipcRenderer.invoke('logs:clear'),
    save: () => ipcRenderer.invoke('logs:save'),
    copy: () => ipcRenderer.invoke('logs:copy'),
  },
  mappings: {
    read: () => ipcRenderer.invoke('mappings:read'),
    write: (pairs: MappingPair[]) => ipcRenderer.invoke('mappings:write', pairs),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
  },
};

contextBridge.exposeInMainWorld('api', api);
