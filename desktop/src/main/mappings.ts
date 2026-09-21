/**
 * mappings.ts - Read/write del archivo `mapping.tsv` en disco.
 *
 * Resolución del path (consistente con `proxy.ts`):
 *
 *   Dev:  `app.getAppPath()/../mapping.tsv` = raíz del repo
 *   Prod: `process.resourcesPath/proxy/mapping.tsv` (US-072)
 *
 * Formato del archivo:
 *   - Una línea por par: `<real>\t<masked>`
 *   - Sin header
 *   - Líneas vacías se ignoran
 *   - Líneas sin tab se ignoran (malformadas)
 *   - Línea final con `\n` (POSIX)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { MappingPair } from '../shared/types';
import { validateMappings } from '../shared/mappings-validation';
import { logger } from './logger';

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

function resolveMappingPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'proxy', 'mapping.tsv');
  }
  return join(app.getAppPath(), '..', 'mapping.tsv');
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
