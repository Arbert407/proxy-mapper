/**
 * version.ts - Lee versiones de los `package.json` del wrapper y del proxy.
 *
 * Estructura de paths por entorno (US-072):
 *
 *   Dev:
 *     - mainDir       = `desktop/dist/main/`
 *     - wrapper pkg   = `desktop/dist/main/../package.json` = `desktop/package.json`
 *     - proxy pkg     = `desktop/dist/main/../../package.json` = raíz del repo
 *
 *   Prod (US-072):
 *     - mainDir       = `resources/app/dist/main/`
 *     - wrapper pkg   = `resources/app/dist/main/../package.json`
 *                       = `resources/app/package.json` (incluido en app.asar)
 *     - proxy pkg     = `process.resourcesPath/proxy/package.json`
 *                       (copiado vía extraResources; vive fuera de app.asar)
 *
 * Si un archivo no se puede leer o parsear, se devuelve '0.0.0' como fallback
 * (en vez de fallar el IPC y romper la UI del sidebar).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const FALLBACK_VERSION = '0.0.0';

const readPackageVersion = (pkgPath: string): string => {
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      const v = (parsed as { version: unknown }).version;
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
};

export const readVersions = (mainDir: string): { wrapper: string; proxy: string } => {
  const wrapperPath = join(mainDir, '../package.json');
  const proxyPath = app.isPackaged
    ? join(process.resourcesPath, 'proxy', 'package.json')
    : join(mainDir, '../../package.json');
  return {
    wrapper: readPackageVersion(wrapperPath),
    proxy: readPackageVersion(proxyPath),
  };
};
