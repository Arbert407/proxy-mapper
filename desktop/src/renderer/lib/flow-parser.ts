/**
 * flow-parser.ts - Parsea el stream de LogEntry en eventos de flujo del proxy.
 *
 * El proxy emite 4 lineas marcadas por round-trip:
 *   [1/4] REQUEST RAW            -> chunk to map:     <texto user-side (real)>
 *   [2/4] REQUEST TRANSFORMED    -> chunk mapped:     <texto LLM-side (masked)>
 *   [3/4] RESPONSE RAW           -> chunk to unmap:   <texto LLM-side (masked)>
 *   [4/4] RESPONSE TRANSFORMED   -> chunk unmapped:   <texto user-side (real)>
 *
 * Un ProxyFlowEvent agrupa las 4 etapas de un mismo round-trip.
 * Cada campo de texto puede contener multiples snippets separados por ", "
 * (delimitador de extractMappedContext). Se pasan como array al componente
 * para que los renderice como filas individuales.
 */
import type { LogEntry, ProxyFlowEvent } from '@shared/types';

const CHUNK_TO_MAP = /^\s*chunk\s+to\s+map:\s*([\s\S]+)$/i;
const CHUNK_MAPPED = /^\s*chunk\s+mapped:\s*([\s\S]+)$/i;
const CHUNK_TO_UNMAP = /^\s*chunk\s+to\s+unmap:\s*([\s\S]+)$/i;
const CHUNK_UNMAPPED = /^\s*chunk\s+unmapped:\s*([\s\S]+)$/i;

const EMPTY_HINT = /0\s+mapped\s+items/i;

interface PartialEvent {
  timestamp: string;
  requestRaw: string[];
  requestMapped: string[];
  responseRaw: string[];
  responseUnmapped: string[];
}

/**
 * Divide un string de contexto (multi-snippet separado por ", ")
 * en un array de snippets individuales. Descarta snippet vacios.
 */
function splitSnippets(text: string): string[] {
  if (typeof text !== 'string') return [];
  return text
    .split(/,\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseFlowEvents(entries: readonly LogEntry[], maxEvents = 3): ProxyFlowEvent[] {
  const completed: ProxyFlowEvent[] = [];
  let current: PartialEvent | null = null;
  let counter = 0;

  const tryFinalize = () => {
    if (
      current &&
      current.requestRaw.length > 0 &&
      current.requestMapped.length > 0 &&
      current.responseRaw.length > 0 &&
      current.responseUnmapped.length > 0
    ) {
      counter += 1;
      completed.push({
        id: `flow-${counter}`,
        timestamp: current.timestamp,
        requestRaw: current.requestRaw,
        requestMapped: current.requestMapped,
        responseRaw: current.responseRaw,
        responseUnmapped: current.responseUnmapped,
      });
    }
    current = null;
  };

  for (const entry of entries) {
    const msg = entry.message;

    if (/\[1\/4\]\s*REQUEST\s*RAW/i.test(msg)) {
      tryFinalize();
      current = {
        timestamp: entry.timestamp,
        requestRaw: [],
        requestMapped: [],
        responseRaw: [],
        responseUnmapped: [],
      };
      continue;
    }

    if (!current) continue;

    let m: RegExpMatchArray | null;
    if ((m = msg.match(CHUNK_TO_MAP))) {
      if (m[1] && !EMPTY_HINT.test(m[1])) {
        current.requestRaw = splitSnippets(m[1]);
      }
    } else if ((m = msg.match(CHUNK_MAPPED))) {
      if (m[1] && !EMPTY_HINT.test(m[1])) {
        current.requestMapped = splitSnippets(m[1]);
      }
    } else if ((m = msg.match(CHUNK_TO_UNMAP))) {
      if (m[1] && !EMPTY_HINT.test(m[1])) {
        current.responseRaw = splitSnippets(m[1]);
      }
    } else if ((m = msg.match(CHUNK_UNMAPPED))) {
      if (m[1] && !EMPTY_HINT.test(m[1])) {
        current.responseUnmapped = splitSnippets(m[1]);
      }
    }
  }

  tryFinalize();

  if (completed.length <= maxEvents) return completed;
  return completed.slice(-maxEvents);
}
