export type ProxyState = 'off' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface ProxyStateChange {
  state: ProxyState;
  reason?: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'leak' | 'done';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

export interface MappingPair {
  real: string;
  masked: string;
}

export interface ProxyFlowEvent {
  id: string;
  timestamp: string;
  requestRaw: string[];
  requestMapped: string[];
  responseRaw: string[];
  responseUnmapped: string[];
}

export interface ProxyApi {
  start: () => Promise<{ ok: boolean; reason?: string }>;
  stop: () => Promise<{ ok: boolean; reason?: string }>;
  onStateChange: (cb: (change: ProxyStateChange) => void) => () => void;
}

export interface LogsApi {
  onAppend: (cb: (entry: LogEntry) => void) => () => void;
  read: () => Promise<LogEntry[]>;
  clear: () => Promise<{ ok: boolean }>;
  save: () => Promise<{ ok: boolean; path?: string; reason?: string }>;
}

export interface MappingsApi {
  read: () => Promise<{ ok: boolean; pairs?: MappingPair[]; path?: string; reason?: string }>;
  write: (pairs: MappingPair[]) => Promise<{ ok: boolean; reason?: string }>;
  export: (pairs: MappingPair[]) => Promise<{ ok: boolean; path?: string; reason?: string }>;
  import: () => Promise<{
    ok: boolean;
    pairs?: MappingPair[];
    skipped?: number;
    path?: string;
    reason?: string;
  }>;
}

export interface AppApi {
  getVersion: () => Promise<{ wrapper: string; proxy: string }>;
}

export interface Api {
  proxy: ProxyApi;
  logs: LogsApi;
  mappings: MappingsApi;
  app: AppApi;
}

declare global {
  interface Window {
    api: Api;
  }
}
