/**
 * mappings-validation.ts - Validación de pares `MappingPair[]`.
 *
 * Usado por:
 * - Renderer (`pages/mappings.tsx`): para mostrar errores inline en cada celda.
 * - Main (`main/mappings.ts`): como defensa en profundidad (US-080) — rechaza
 *   pares con valores vacíos o tab/newline que corromperían el TSV.
 *
 * Reglas:
 * 1. `real` y `masked` no pueden estar vacíos (tras trim).
 * 2. `real` y `masked` no pueden contener `\t`, `\n` o `\r` (romperían el
 *    formato TSV — un par con `\n` se partiría en dos líneas al re-leer).
 * 3. No se permiten duplicados de `real` entre filas (el proxy sobreescribiría
 *    el valor al usar la primera coincidencia).
 *
 * La estructura de errores es por índice de fila, con campos opcionales
 * `real` y `masked` que apuntan al mensaje de error (string vacío = OK).
 */
import type { MappingPair } from './types';

export interface PairError {
  real?: string;
  masked?: string;
  duplicate?: boolean;
}

export type PairErrors = Record<number, PairError>;

export function validateMappings(pairs: MappingPair[]): PairErrors {
  const errors: PairErrors = {};
  const realIndices = new Map<string, number[]>();

  for (let i = 0; i < pairs.length; i++) {
    const { real, masked } = pairs[i];
    const err: PairError = {};

    if (real.trim().length === 0) {
      err.real = 'Real no puede estar vacío';
    } else if (/[\t\n\r]/.test(real)) {
      err.real = 'Real no puede contener tab ni salto de línea';
    }

    if (masked.trim().length === 0) {
      err.masked = 'Masked no puede estar vacío';
    } else if (/[\t\n\r]/.test(masked)) {
      err.masked = 'Masked no puede contener tab ni salto de línea';
    }

    if (Object.keys(err).length > 0) {
      errors[i] = err;
    }

    if (real.trim().length > 0) {
      const list = realIndices.get(real) ?? [];
      list.push(i);
      realIndices.set(real, list);
    }
  }

  for (const [value, indices] of realIndices.entries()) {
    if (indices.length < 2) continue;
    for (const idx of indices) {
      const others = indices.filter((j) => j !== idx).map((j) => j + 1);
      const err = errors[idx] ?? {};
      err.real = `Real duplicado (también fila${others.length > 1 ? 's' : ''} ${others.join(', ')}): "${value}"`;
      err.duplicate = true;
      errors[idx] = err;
    }
  }

  return errors;
}

/**
 * Resumen agregado de errores: útil para decidir si se permite auto-save
 * o para mostrar "Hay N errores" en el header.
 */
export function countErrors(errors: PairErrors): number {
  let n = 0;
  for (const err of Object.values(errors)) {
    if (err.real) n++;
    if (err.masked) n++;
  }
  return n;
}
