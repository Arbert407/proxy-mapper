/**
 * proxy-bootstrap.ts - Bootstrap del proxy en `userData` (primer arranque).
 *
 * Por que existe:
 *   - El instalador redistribuible NO debe llevar el `mapping.tsv` del usuario
 *     hardcodeado (datos confidenciales). Tampoco el del dev que se sincroniza
 *     desde la raiz del repo en cada build.
 *   - En produccion, `process.resourcesPath/proxy/` es de solo lectura; el
 *     proxy necesita un directorio writable per-user donde leer/escribir
 *     `mapping.tsv`.
 *
 * Estrategia:
 *   1. Al arrancar la app, crear `userData/proxy/` si no existe.
 *   2. Copiar `index.js` + `package.json` desde `process.resourcesPath/proxy/`
 *      (los archivos que el instalador incluye via `extraResources`, ver
 *      electron-builder.yml). Esto los deja writable per-user.
 *   3. Si `userData/proxy/mapping.tsv` no existe, copiar el starter vacio
 *      desde el bundle (`process.resourcesPath/proxy/mapping.tsv`). Si el
 *      bundle tampoco lo trae, crear vacio en userData como fallback.
 *   4. El modulo `proxy.ts` despues forkea desde `userData/proxy/index.js`
 *      con `cwd = userData/proxy/` — el `index.js` resuelve su propio
 *      `__dirname` via `import.meta.url`, que apunta a userData, y encuentra
 *      `mapping.tsv` al lado.
 *   5. El editor de mappings (`mappings.ts`) lee/escribe el MISMO path
 *      (`userData/proxy/mapping.tsv`), sin duplicacion.
 *
 * Por que `extraResources` en vez de `asarUnpack`:
 *   - `asarUnpack` extrae los archivos a `app.asar.unpacked/proxy/`, pero el
 *     target `portable` de electron-builder NO desempaqueta `asarUnpacked` al
 *     extraer a TEMP (asar.unpacked queda vacio → bootstrap falla con ENOENT).
 *   - `extraResources` SI extrae a `process.resourcesPath/proxy/` para AMBOS
 *     targets (NSIS y portable), que es lo que necesitamos.
 *   - `utilityProcess.fork()` ademas requiere archivos en disco real (asar es
 *     un FS virtual); `process.resourcesPath/proxy/` cumple eso.
 */
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { logger } from './logger';

function getUserDataProxyDir(): string {
  return join(app.getPath('userData'), 'proxy');
}

function getBundleProxyDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'proxy');
  }
  return join(app.getAppPath(), '..', 'proxy');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Asegura que `userData/proxy/` contiene el codigo del proxy y un
 * `mapping.tsv` vacio. Idempotente: safe de llamar en cada arranque.
 *
 * @returns Path absoluto al directorio `userData/proxy/` listo para forkear.
 */
export async function ensureUserDataProxy(): Promise<string> {
  const userDir = getUserDataProxyDir();

  try {
    await mkdir(userDir, { recursive: true });
    logger.info(`bootstrap: directorio de proxy en userData = ${userDir}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`bootstrap: no se pudo crear ${userDir}: ${reason}`);
    throw err;
  }

  const bundleDir = getBundleProxyDir();
  const filesToSync: Array<{ name: string; mandatory: boolean }> = [
    { name: 'index.js', mandatory: true },
    { name: 'package.json', mandatory: true },
  ];

  for (const { name, mandatory } of filesToSync) {
    const src = join(bundleDir, name);
    const dst = join(userDir, name);
    try {
      await copyFile(src, dst);
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

  const mappingPath = join(userDir, 'mapping.tsv');
  if (!(await fileExists(mappingPath))) {
    const bundleMapping = join(bundleDir, 'mapping.tsv');
    try {
      if (await fileExists(bundleMapping)) {
        await copyFile(bundleMapping, mappingPath);
        logger.info(`bootstrap: mapping.tsv copiado desde bundle a ${mappingPath}`);
      } else {
        await writeFile(mappingPath, '', 'utf-8');
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

export { getUserDataProxyDir };
