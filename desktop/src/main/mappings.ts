/**
 * mappings.ts - Read/write del archivo `mapping.tsv` en disco.
 *
 * Resolución del path (consistente con `proxy.ts` y `proxy-bootstrap.ts`):
 *
 *   Dev:  `app.getAppPath()/../../proxy/mapping.tsv` = carpeta `proxy/` del repo
 *   Prod: `app.getPath('userData')/proxy/mapping.tsv`
 *
 * Formato del archivo:
 *   - Una línea por par: `<real>\t<masked>`
 *   - Sin header
 *   - Líneas vacías se ignoran
 *   - Líneas sin tab se ignoran (malformadas)
 *   - Línea final con `\n` (POSIX)
 *
 * NOTA: `mapping.tsv` NO se empaqueta en el instalador (ver
 * `proxy-bootstrap.ts`). En producción se genera VACIO en userData al
 * primer arranque; el usuario lo puebla desde la vista /mappings o
 * edita el archivo a mano.
 *
 * US-095: import/export explícito del TSV (botones en /mappings). El
 * export usa el mismo formato que `mapping.tsv` para que el archivo sea
 * drop-in: el usuario puede mover mappings entre máquinas copiando el
 * .tsv. El import filtra pares inválidos (vacíos, con `\t`/`\n`,
 * duplicados) y reporta cuántos se descartaron.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, dialog } from 'electron';
import type { MappingPair } from '../shared/types';
import { validateMappings } from '../shared/mappings-validation';
import { logger } from './logger';
import { getUserDataProxyDir } from './proxy-bootstrap';

export const EXPORT_FILENAME = 'export_mappings_proxy_mapper.tsv';

export interface ReadResult {
  ok: boolean;
  pairs?: MappingPair[];
  path?: string;
  reason?: string;
}

export interface WriteResult {
  ok: boolean;
  reason?: string;
}

export interface ExportResult {
  ok: boolean;
  path?: string;
  reason?: string;
}

export interface ImportResult {
  ok: boolean;
  pairs?: MappingPair[];
  skipped?: number;
  path?: string;
  reason?: string;
}

/**
 * Path al `mapping.tsv` del proxy.
 *
 * - Dev:  `<repo>/proxy/mapping.tsv` (proxy vive en `proxy/`, wrapper en `desktop/`).
 * - Prod: `userData/proxy/mapping.tsv` — directorio writable, per-user,
 *         separado del codigo del wrapper. Generado vacio por
 *         `ensureUserDataProxy()` en el primer arranque.
 *
 * Si el wrapper arranca antes de que `ensureUserDataProxy()` corra (p.ej.
 * la vista /mappings se monta antes que el primer `startProxy()`), esta
 * funcion igualmente retorna el path correcto. La creacion del archivo
 * ocurre en el bootstrap; si por algun motivo no se creo todavia, el
 * `readMappings` lo trata como `pairs: []` (no es error, es estado
 * inicial valido para el editor).
 */
function resolveMappingPath(): string {
  if (app.isPackaged) {
    return join(getUserDataProxyDir(), 'mapping.tsv');
  }
  return join(app.getAppPath(), '..', 'proxy', 'mapping.tsv');
}

function parseTsv(content: string): MappingPair[] {
  const pairs: MappingPair[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, '');
    if (!line) continue;
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const real = line.substring(0, tabIdx);
    const masked = line.substring(tabIdx + 1);
    if (!real || !masked) continue;
    pairs.push({ real, masked });
  }
  return pairs;
}

function serializeTsv(pairs: MappingPair[]): string {
  return pairs.map((p) => `${p.real}\t${p.masked}`).join('\n') + '\n';
}

export async function readMappings(): Promise<ReadResult> {
  const path = resolveMappingPath();
  try {
    const content = await readFile(path, 'utf-8');
    const pairs = parseTsv(content);
    logger.info(`mappings.read: ${pairs.length} pares leídos desde ${path}`);
    return { ok: true, pairs, path };
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      logger.info(`mappings.read: archivo no existe en ${path}, retornando []`);
      return { ok: true, pairs: [], path };
    }
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.read: error al leer ${path}: ${reason}`);
    return { ok: false, reason };
  }
}

export async function writeMappings(pairs: MappingPair[]): Promise<WriteResult> {
  const path = resolveMappingPath();
  // US-093 (defensa en profundidad): rechaza pares que romperían el TSV
  // aunque el renderer los haya dejado pasar (bug, IPC forzado, etc.).
  // NO chequeamos duplicados aquí porque es responsabilidad del renderer
  // mostrar el error inline (UX); desde main sólo protegemos integridad del archivo.
  const errors = validateMappings(pairs);
  for (const err of Object.values(errors)) {
    if (err.real || err.masked) {
      if (!err.duplicate) {
        logger.warn(`mappings.write: rechazo por validación: ${err.real ?? err.masked}`);
        return { ok: false, reason: 'invalid_pairs' };
      }
    }
  }
  try {
    await writeFile(path, serializeTsv(pairs), 'utf-8');
    logger.info(`mappings.write: ${pairs.length} pares escritos en ${path}`);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.write: error al escribir ${path}: ${reason}`);
    return { ok: false, reason };
  }
}

/**
 * Abre un diálogo nativo de "Guardar como…" y vuelca los pares al TSV elegido.
 *
 * - El nombre por defecto es `export_mappings_proxy_mapper.tsv` (US-095).
 * - El filtro es `*.tsv` con fallback a "Todos los archivos" — el formato
 *   externo es el MISMO que `mapping.tsv`, así el archivo es drop-in en
 *   cualquier instalación.
 * - Si el usuario cancela, retorna `{ ok: false, reason: 'canceled' }` (no
 *   es error: el handler de UI lo trata como no-op silencioso, mismo
 *   patrón que `logs:save`).
 *
 * @param win Ventana padre (modal del diálogo).
 * @param pairs Pares a exportar — se serializan tal cual con `serializeTsv`.
 * @returns `{ ok, path? }` o `{ ok: false, reason }`.
 */
export async function exportMappingsToFile(
  win: BrowserWindow,
  pairs: MappingPair[],
): Promise<ExportResult> {
  const dlg = await dialog.showSaveDialog(win, {
    title: 'Exportar mappings',
    defaultPath: EXPORT_FILENAME,
    filters: [
      { name: 'TSV (mappings)', extensions: ['tsv'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
  });

  if (dlg.canceled || !dlg.filePath) {
    logger.info('mappings.export: cancelado por el usuario');
    return { ok: false, reason: 'canceled' };
  }

  try {
    await writeFile(dlg.filePath, serializeTsv(pairs), 'utf-8');
    logger.info(`mappings.export: ${pairs.length} pares escritos en ${dlg.filePath}`);
    return { ok: true, path: dlg.filePath };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.export: error al escribir ${dlg.filePath}: ${reason}`);
    return { ok: false, reason };
  }
}

/**
 * Abre un diálogo nativo de "Abrir…" y carga pares desde el TSV elegido.
 *
 * Tolerancia a archivos sucios:
 * - Filtra y descarta los pares que fallen validación (vacíos, con tab/salto
 *   de línea, `real` duplicado). Devuelve el conteo en `skipped` para que
 *   la UI lo muestre al usuario.
 * - Si NINGÚN par sobrevive la validación, retorna `reason: 'no_valid_pairs'`
 *   (no se hace write automático — el renderer decide qué hacer).
 * - Si el archivo está vacío o no tiene pares parseables, retorna
 *   `pairs: []` con `ok: true` (es un estado válido: el usuario exportó
 *   un mappings vacío y quiere reimportarlo).
 *
 * Formato esperado: idéntico al de `mapping.tsv` (un par por línea, tab,
 * sin header). Si el archivo tiene un header `real\tmasked` en la primera
 * línea, se filtra como par vacío (real=='' y masked=='masked') y queda
 * en `skipped`.
 *
 * @param win Ventana padre (modal del diálogo).
 */
export async function importMappingsFromFile(win: BrowserWindow): Promise<ImportResult> {
  const dlg = await dialog.showOpenDialog(win, {
    title: 'Importar mappings',
    properties: ['openFile'],
    filters: [
      { name: 'TSV (mappings)', extensions: ['tsv'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ],
  });

  if (dlg.canceled || dlg.filePaths.length === 0) {
    logger.info('mappings.import: cancelado por el usuario');
    return { ok: false, reason: 'canceled' };
  }

  const filePath = dlg.filePaths[0]!;
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`mappings.import: error al leer ${filePath}: ${reason}`);
    return { ok: false, reason };
  }

  const allParsed = parseTsv(content);
  const errors = validateMappings(allParsed);
  const valid: MappingPair[] = [];
  for (let i = 0; i < allParsed.length; i++) {
    const err = errors[i];
    if (!err?.real && !err?.masked) {
      valid.push(allParsed[i]!);
    }
  }
  const skipped = allParsed.length - valid.length;

  logger.info(
    `mappings.import: ${valid.length} válidos, ${skipped} omitidos desde ${filePath}`,
  );

  if (allParsed.length > 0 && valid.length === 0) {
    return { ok: false, reason: 'no_valid_pairs', path: filePath };
  }

  return { ok: true, pairs: valid, skipped, path: filePath };
}
