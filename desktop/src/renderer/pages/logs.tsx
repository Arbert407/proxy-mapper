import { ArrowDown, Copy, Filter, LayoutGrid, List, Save, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ErrorBoundary } from '@/components/error-boundary';
import { FlowView } from '@/components/flow-view';
import { Button } from '@/components/ui/button';
import { useFlowEvents } from '@/hooks/use-flow-events';
import { useLogsStream } from '@/hooks/use-logs-stream';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { LogEntry, LogLevel } from '@shared/types';

type ViewMode = 'logs' | 'diagram';

const CLEAR_CONFIRM_THRESHOLD = 100;
const MAX_FLOW_EVENTS = 3;

const LEVEL_CLASS: Record<LogLevel, string> = {
  error: 'text-red-400',
  leak: 'text-red-500 font-bold',
  warn: 'text-yellow-400',
  done: 'text-green-400',
  info: 'text-slate-300',
};

interface LogLineProps {
  entry: LogEntry;
  rowIndex: number;
}

const LogLine = ({ entry, rowIndex }: LogLineProps) => (
  <div className="px-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
    <span className="text-slate-500 select-none mr-3 tabular-nums">{rowIndex + 1}</span>
    <span className="text-slate-500">{entry.timestamp}</span>{' '}
    <span className={LEVEL_CLASS[entry.level]}>{entry.message}</span>
  </div>
);

interface LogsListProps {
  entries: readonly LogEntry[];
  filter: string;
}

const LogsList = ({ entries, filter }: LogsListProps) => {
  const [showJumpButton, setShowJumpButton] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const filtered = useMemo(() => {
    if (!filter) return entries;
    const needle = filter.toLowerCase();
    return entries.filter((e) => e.message.toLowerCase().includes(needle));
  }, [entries, filter]);

  const handleJumpToBottom = useCallback(() => {
    if (filtered.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: filtered.length - 1,
      behavior: 'smooth',
      align: 'end',
    });
  }, [filtered.length]);

  const isFilteredEmpty = filtered.length === 0;

  return (
    <div className="relative flex-1 min-h-0 bg-slate-950">
      <Virtuoso
        ref={virtuosoRef}
        data={filtered}
        followOutput="auto"
        atBottomStateChange={(atBottom) => setShowJumpButton(!atBottom)}
        computeItemKey={(index) => String(index)}
        itemContent={(index, e) => <LogLine entry={e} rowIndex={index} />}
        components={{
          EmptyPlaceholder: () => (
            <div className="flex items-center justify-center h-full p-4 text-muted-foreground italic font-mono text-xs">
              {filter ? 'Sin coincidencias' : 'Esperando logs del proxy…'}
            </div>
          ),
        }}
        className="h-full"
      />
      <button
        type="button"
        onClick={handleJumpToBottom}
        aria-label="Volver al final del log"
        className={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 px-3 h-9 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs font-medium',
          showJumpButton && !isFilteredEmpty
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        <ArrowDown className="h-3.5 w-3.5" /> Volver al final
      </button>
    </div>
  );
};

interface LogsToolbarProps {
  entries: readonly LogEntry[];
  filter: string;
  onFilterChange: (value: string) => void;
  onClear: () => void;
}

const LogsToolbar = ({
  entries,
  filter,
  onFilterChange,
  onClear,
}: LogsToolbarProps) => {
  const handleClear = useCallback(async () => {
    if (entries.length > CLEAR_CONFIRM_THRESHOLD) {
      const ok = window.confirm(
        `¿Vaciar ${entries.length} líneas del buffer de logs?\n` +
          'El archivo app.log en disco NO se modifica.',
      );
      if (!ok) return;
    }
    onClear();
    try {
      const result = await window.api?.logs.clear();
      if (result && !result.ok) {
        toast.warning('Buffer local vaciado, pero main rechazó clear', {
          description: 'Revisa app.log para detalles.',
        });
      }
    } catch (err) {
      toast.error('No se pudo limpiar el buffer en main', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [entries.length, onClear]);

  const handleSave = useCallback(async () => {
    try {
      const result = await window.api?.logs.save();
      if (!result) return;
      if (result.ok) {
        toast.success('Logs guardados', { description: result.path });
      } else if (result.reason !== 'canceled') {
        toast.error('No se pudieron guardar los logs', {
          description: result.reason,
        });
      }
    } catch (err) {
      toast.error('No se pudieron guardar los logs', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (entries.length === 0) return;
    const text = entries.map((e) => `${e.timestamp} ${e.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado', {
        description: `${entries.length} líneas al portapapeles`,
      });
    } catch (err) {
      toast.error('No se pudo copiar', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [entries]);

  return (
    <>
      <div className="relative">
        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filtrar…"
          aria-label="Filtrar logs"
          className="h-8 w-48 rounded-md border border-input bg-background pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClear}
        disabled={entries.length === 0}
      >
        <Trash2 className="h-4 w-4" /> Limpiar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        disabled={entries.length === 0}
      >
        <Copy className="h-4 w-4" /> Copiar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        disabled={entries.length === 0}
      >
        <Save className="h-4 w-4" /> Guardar
      </Button>
    </>
  );
};

const FlowFallback = () => (
  <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500 text-sm font-mono italic p-4">
    Vista de diagrama no disponible
  </div>
);

interface ModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const ModeToggle = ({ mode, onChange }: ModeToggleProps) => (
  <div
    className="inline-flex items-center rounded-md border border-input bg-background p-0.5"
    role="group"
    aria-label="Modo de visualización"
  >
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange('logs')}
      aria-pressed={mode === 'logs'}
      className={cn(
        'h-7 px-3 text-xs',
        mode === 'logs' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      )}
    >
      <List className="h-3.5 w-3.5" /> Normal
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange('diagram')}
      aria-pressed={mode === 'diagram'}
      className={cn(
        'h-7 px-3 text-xs',
        mode === 'diagram' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      )}
    >
      <LayoutGrid className="h-3.5 w-3.5" /> Diagrama
    </Button>
  </div>
);

/**
 * logs.tsx - Página /logs con dos modos de visualización.
 *
 * - Modo "logs": visor de logs crudos (FIFO buffer del main, Épica 6).
 *   Header incluye filtro, Limpiar, Copiar, Guardar.
 * - Modo "diagram": diagrama de secuencia de los últimos MAX_FLOW_EVENTS
 *   round-trips del proxy, parseados desde el buffer.
 *
 * El toggle es un segmented control en el header (siempre visible).
 * Los botones de filtro/limpiar/copiar/guardar solo aplican al modo logs.
 */
export const LogsPage = () => {
  const { entries, clear } = useLogsStream();
  const [mode, setMode] = useState<ViewMode>('logs');
  const [filter, setFilter] = useState('');
  const flowEvents = useFlowEvents(entries, MAX_FLOW_EVENTS);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-2 border-b border-border bg-card/40 px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold text-foreground mr-auto">
          Logs del proxy
        </h1>
        <ModeToggle mode={mode} onChange={setMode} />
        {mode === 'logs' && (
          <LogsToolbar
            entries={entries}
            filter={filter}
            onFilterChange={setFilter}
            onClear={clear}
          />
        )}
      </header>
      {mode === 'logs' ? (
        <LogsList entries={entries} filter={filter} />
      ) : (
        <ErrorBoundary fallback={<FlowFallback />}>
          <FlowView events={flowEvents} />
        </ErrorBoundary>
      )}
    </div>
  );
};