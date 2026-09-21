/**
 * use-logs-stream.ts - Suscribe al IPC `logs:append` y mantiene los entries.
 *
 * Devuelve `{ entries, clear }`:
 * - `entries`: snapshot actual del renderer. Al mount se hidrata desde el
 *   buffer FIFO del main vía `logs:read`, luego se mantiene con cada
 *   `logs:append`. Así, las líneas emitidas ANTES de navegar a `/logs`
 *   son visibles.
 * - `clear()`: limpia el snapshot local. Acompaña a `api.logs.clear()` que
 *   limpia el buffer del main (US-063).
 *
 * Race "hydrate vs clear":
 * Si el usuario clickea Limpiar mientras el `logs:read` está en vuelo, el
 * flag `hydratedRef` se setea y la hidratación llegada después se descarta
 * — respetamos la intención del usuario de querer buffer vacío.
 *
 * Race "hydrate vs append" (no cubierta totalmente):
 * Existe una ventana de microsegundos entre `setEntries(initial)` y
 * `api.onAppend(...)` donde un `logs:append` llegaría sin listener y se
 * perdería del snapshot. En la práctica la probabilidad es negligible
 * (proxy emite a 1-10 Hz, ventana <1 ms) y el main ya tiene la entry en
 * buffer — quedaría visible en el próximo reload. Trade-off aceptado en v1.
 *
 * Instrumentación defensiva (per STACK.md §Debug): los console.log/warn
 * quedan aunque no haya bug activo, sirven para diagnosticar futuros
 * problemas de suscripción IPC + React StrictMode.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry } from '@shared/types';

export interface LogsStream {
  entries: LogEntry[];
  clear: () => void;
}

export const useLogsStream = (): LogsStream => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  // true cuando (a) el usuario invocó clear() o (b) la hidratación completó.
  // Si está true y llega el resultado del hydrate, lo descartamos.
  const hydratedRef = useRef(false);

  useEffect(() => {
    const api = window.api?.logs;
    // eslint-disable-next-line no-console
    console.log('[useLogsStream] mount, api =', api ? 'presente' : 'ausente');
    if (!api) return undefined;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      // 1) Hidratar con el buffer FIFO actual del main (logs previos a mount).
      let initial: LogEntry[] = [];
      if (typeof api.read === 'function') {
        try {
          const result = await api.read();
          if (cancelled) return;
          if (Array.isArray(result)) initial = result;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[useLogsStream] hydrate falló:', err);
        }
      }

      if (cancelled) return;

      // Si el usuario limpió durante el await, no reintroducir entries.
      if (!hydratedRef.current && initial.length > 0) {
        hydratedRef.current = true;
        // eslint-disable-next-line no-console
        console.log(`[useLogsStream] hidrato con ${initial.length} entries previos`);
        setEntries(initial);
      } else {
        hydratedRef.current = true;
      }

      // 2) Suscribirse a emissions futuras.
      if (typeof api.onAppend !== 'function') {
        // eslint-disable-next-line no-console
        console.warn('[useLogsStream] api.onAppend no es función');
        return;
      }
      unsubscribe = api.onAppend((entry) => {
        setEntries((prev) => [...prev, entry]);
      });
      // eslint-disable-next-line no-console
      console.log('[useLogsStream] suscrito a logs:append');
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const clear = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[useLogsStream] clear local snapshot');
    hydratedRef.current = true;
    setEntries([]);
  }, []);

  return { entries, clear };
};
