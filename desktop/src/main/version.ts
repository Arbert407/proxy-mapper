/**
 * version.ts - Lee versiones de los `package.json` del wrapper y del proxy.
 *
 * Estructura de paths (resueltos en runtime):
 *   - Wrapper:  `dist/main/index.js` → `../package.json` (desktop/package.json)
 *   - Proxy:    `dist/main/index.js` → `../../package.json` (raíz del proyecto)
 *
 * Si un archivo no se puede leer o parsear, se devuelve '0.0.0' como fallback
 * (en vez de fallar el IPC y romper la UI del sidebar).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

export const readVersions = (mainDir: string): { wrapper: string; proxy: string } => ({
  wrapper: readPackageVersion(join(mainDir, '../package.json')),
  proxy: readPackageVersion(join(mainDir, '../../package.json')),
});
