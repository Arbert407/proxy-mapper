/**
 * use-mappings.ts - Lee los pares `real`/`masked` desde el `mapping.tsv`.
 *
 * Cachea en memoria por sesión: una sola lectura IPC. Se invalida sólo
 * cuando el usuario navega a /mappings y graba (futuro hook `mappingsValid`
 * podría dispararlo — fuera de scope v1).
 *
 * Si la lectura falla o el archivo no existe, retorna arrays vacíos y el
 * `FlowView` cae a "(sin contenido)" en cada card (defensa graceful).
 */
import { useEffect, useState } from 'react';
import type { MappingPair } from '@shared/types';

const EMPTY: MappingPair[] = [];

export const useMappings = (): readonly MappingPair[] => {
  const [pairs, setPairs] = useState<readonly MappingPair[]>(EMPTY);

  useEffect(() => {
    const api = window.api?.mappings;
    if (!api || typeof api.read !== 'function') {
      setPairs(EMPTY);
      return undefined;
    }
    let cancelled = false;
    api
      .read()
      .then((result) => {
        if (cancelled) return;
        if (result && result.ok && Array.isArray(result.pairs)) {
          setPairs(result.pairs);
        } else {
          setPairs(EMPTY);
        }
      })
      .catch(() => {
        if (!cancelled) setPairs(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return pairs;
};