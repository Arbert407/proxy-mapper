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
    if (!api) return undefined;
    const unsubscribe = api.onAppend((entry) => {
      setEntries((prev) => [...prev, entry]);
    });
    return unsubscribe;
  }, []);

  return entries;
};
