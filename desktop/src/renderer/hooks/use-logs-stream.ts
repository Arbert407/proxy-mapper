/**
 * use-logs-stream.ts - Suscribe al IPC `logs:append` y acumula entries.
 *
 * El buffer del main (US-062) es la fuente de verdad para save/copy;
 * este hook mantiene la lista de entries para renderizar en LogsView.
 */
import { useEffect, useState } from 'react';
import type { LogEntry } from '@shared/types';

export const useLogsStream = (): LogEntry[] => {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const api = window.api?.logs;
    // eslint-disable-next-line no-console
    console.log('[useLogsStream] mount, window.api?.logs =', api);
    if (!api || typeof api.onAppend !== 'function') {
      // eslint-disable-next-line no-console
      console.warn('[useLogsStream] no api o no api.onAppend — no se suscribe');
      return undefined;
    }
    const unsubscribe = api.onAppend((entry) => {
      // eslint-disable-next-line no-console
      console.log('[useLogsStream] entry recibido:', entry.message?.substring(0, 60));
      setEntries((prev) => [...prev, entry]);
    });
    // eslint-disable-next-line no-console
    console.log('[useLogsStream] suscrito, unsubscribe type =', typeof unsubscribe);
    return unsubscribe;
  }, []);

  return entries;
};
