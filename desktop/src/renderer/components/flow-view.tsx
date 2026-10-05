/**
 * flow-view.tsx - Diagrama de secuencia de los round-trips del proxy.
 *
 * Cada ProxyFlowEvent se renderiza como 4 tarjetas:
 *   1. Real (verde)   - mensaje del actor con nombres reales
 *   2. Masked (ambar) - mensaje que sale hacia el LLM
 *   3. Masked (ambar) - respuesta del LLM
 *   4. Real (verde)   - respuesta devuelta al actor
 *
 * Conectadas por flechas SVG: Actor -> [1] -> [2] -> LLM -> [3] -> [4] -> Actor.
 * Si hay multiples round-trips, se apilan horizontalmente (scroll horizontal).
 */
import { Cloud, User } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProxyFlowEvent } from '@shared/types';
import { cn } from '@/lib/utils';

interface FlowViewProps {
  events: readonly ProxyFlowEvent[];
}

const COLOR_REAL = 'text-emerald-400';
const COLOR_MASKED = 'text-amber-400';
const CARD_BG = 'bg-slate-900';
const CARD_BORDER = 'border-slate-700';

interface CardProps {
  index: number;
  snippets: string[];
  tone: 'real' | 'masked';
}

const FlowCard = ({ index, snippets, tone }: CardProps) => {
  const safeSnippets = Array.isArray(snippets) ? snippets : [];
  return (
    <div
      className={cn(
        'relative flex-1 min-w-0 max-w-md rounded-md border px-3 py-2 shadow-sm flex flex-col gap-1',
        CARD_BG,
        CARD_BORDER,
        tone === 'real' ? COLOR_REAL : COLOR_MASKED,
      )}
    >
      <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-500 select-none">
        {index}
      </span>
      {safeSnippets.length === 0 ? (
        <p className="font-mono text-xs italic pt-3 pr-1 text-slate-600">
          (sin contenido)
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 pt-3 pr-1 list-none">
          {safeSnippets.map((s, i) => (
            <li key={i} className="font-mono text-xs leading-snug break-words">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Actor = () => (
  <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
    <User className="h-10 w-10" strokeWidth={1.5} />
    <span className="text-[10px] uppercase tracking-wider text-slate-500">Actor</span>
  </div>
);

const Llm = () => (
  <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
    <Cloud className="h-10 w-10" strokeWidth={1.5} />
    <span className="text-[10px] uppercase tracking-wider text-slate-500">LLM</span>
  </div>
);

interface FlowDiagramProps {
  event: ProxyFlowEvent;
}

const FlowDiagram = ({ event }: FlowDiagramProps) => {
  const safeEvent = event && typeof event === 'object' ? event : null;
  if (!safeEvent) {
    return (
      <div className="text-slate-600 text-xs font-mono p-4">
        Datos del evento no disponibles
      </div>
    );
  }
  return (
    <div className="flex flex-col items-stretch shrink-0">
      {/* Header: Actor + top row (cards 1 + 2) + LLM */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2 pt-1">
          <Actor />
        </div>
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-3">
            <FlowCard index={1} snippets={safeEvent.requestRaw} tone="real" />
            <span className="text-slate-600 text-lg leading-none mt-2 shrink-0">→</span>
            <FlowCard index={2} snippets={safeEvent.requestMapped} tone="masked" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="text-xs uppercase tracking-wider">Actor</span>
              <span className="text-lg leading-none">↑</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="text-xs uppercase tracking-wider">LLM</span>
              <span className="text-lg leading-none">↓</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 pt-1">
          <Llm />
        </div>
      </div>

      {/* Footer: bottom row (cards 4 + 3) */}
      <div className="flex items-start gap-4 mt-4">
        <div className="flex flex-col items-center gap-2 pt-1">
          <Actor />
        </div>
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-3">
            <FlowCard index={4} snippets={safeEvent.responseUnmapped} tone="real" />
            <span className="text-slate-600 text-lg leading-none mt-2 shrink-0">←</span>
            <FlowCard index={3} snippets={safeEvent.responseRaw} tone="masked" />
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <span className="text-xs uppercase tracking-wider">LLM</span>
            <span className="text-lg leading-none">↑</span>
            <span className="text-xs uppercase tracking-wider ml-4">Actor</span>
            <span className="text-lg leading-none">↑</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 pt-1">
          <Llm />
        </div>
      </div>
    </div>
  );
};

const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
    <Cloud className="h-10 w-10 opacity-40" />
    <p className="text-xs font-mono italic">Esperando logs del proxy…</p>
  </div>
);

export const FlowView = ({ events }: FlowViewProps) => {
  const [pulseId, setPulseId] = useState<string | null>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!events || events.length === 0) return;
    const last = events[events.length - 1];
    if (last && last.id !== lastIdRef.current) {
      lastIdRef.current = last.id;
      setPulseId(last.id);
      const t = setTimeout(() => setPulseId(null), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [events]);

  if (!events || events.length === 0) return <EmptyState />;

  let reversed: ProxyFlowEvent[] = [];
  try {
    reversed = [...events].reverse();
  } catch {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm gap-2">
        <span>Vista de diagrama no disponible</span>
      </div>
    );
  }

  let content: ReactNode;
  try {
    content = (
      <div className="flex flex-col items-stretch gap-6">
        {reversed.map((event, idx) => (
          <div
            key={event.id}
            className={cn(
              'transition-opacity duration-300',
              pulseId && pulseId !== event.id && 'opacity-50',
              pulseId === event.id && 'opacity-100',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                {idx === 0 ? 'Msj. más reciente' : `#${reversed.length - idx}`}
              </span>
              <span className="text-[10px] font-mono text-slate-500">{event.timestamp}</span>
            </div>
            <FlowDiagram event={event} />
            {idx < reversed.length - 1 && (
              <div className="border-t border-slate-800 mt-4" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    );
  } catch {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm gap-2">
        <span>Vista de diagrama no disponible</span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950 px-6 py-4">
      {content}
    </div>
  );
};
