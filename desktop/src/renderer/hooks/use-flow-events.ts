/**
 * use-flow-events.ts - Memoiza los ultimos N round-trips del proxy.
 *
 * Re-deriva la lista cuando cambia `entries` (nueva log entry del IPC).
 * La logica de parseo vive en lib/flow-parser.ts (pura, testeable).
 */
import { useMemo } from 'react';
import type { LogEntry, ProxyFlowEvent } from '@shared/types';
import { parseFlowEvents } from '@/lib/flow-parser';

export function useFlowEvents(
  entries: readonly LogEntry[],
  maxEvents = 3,
): ProxyFlowEvent[] {
  return useMemo(() => {
    if (!Array.isArray(entries)) return [];
    try {
      return parseFlowEvents(entries, maxEvents);
    } catch {
      return [];
    }
  }, [entries, maxEvents]);
}
