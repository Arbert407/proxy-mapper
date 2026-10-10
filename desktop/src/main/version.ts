/**
 * version.ts - Lee versiones de los `package.json` del wrapper y del proxy.
 *
 * Estructura de paths por entorno:
 *
 *   Dev:
 *     - mainDir       = `desktop/dist/main/`
 *     - wrapper pkg   = `desktop/dist/main/../package.json` = `desktop/package.json`
 *     - proxy pkg     = `desktop/dist/main/../../../proxy/package.json` = `<repo>/proxy/`
 *
 *   Prod:
 *     - mainDir       = `resources/app/dist/main/`
 *     - wrapper pkg   = `resources/app/dist/main/../package.json`
 *                       = `resources/app/package.json` (incluido en app.asar)
 *     - proxy pkg     = `userData/proxy/package.json` — copia sincronizada
 *                       desde `process.resourcesPath/proxy/` por
 *                       `ensureUserDataProxy()` (ver `proxy-bootstrap.ts`).
 *                       Es la MISMA version que el bundleado en el asar; leer
 *                       desde aca es consistente con donde el proxy efectivamente corre.
 *
 * Si un archivo no se puede leer o parsear, se devuelve '0.0.0' como fallback
 * (en vez de fallar el IPC y romper la UI del sidebar).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getUserDataProxyDir } from './proxy-bootstrap';

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
    ? join(getUserDataProxyDir(), 'package.json')
    : join(mainDir, '../../../proxy/package.json');
  return {
    wrapper: readPackageVersion(wrapperPath),
    proxy: readPackageVersion(proxyPath),
  };
};
